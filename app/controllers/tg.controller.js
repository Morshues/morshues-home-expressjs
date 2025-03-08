const { Api, TelegramClient } = require('telegram');
const { RPCError } = require('telegram/errors');
const { StringSession } = require('telegram/sessions');
const fs = require('fs');
const url = require('url');

const TG_API_ID = parseInt(process.env.TG_API_ID)
const TG_API_HASH = process.env.TG_API_HASH
const sessionString = fs.existsSync('session.txt') ? fs.readFileSync('session.txt', 'utf8') : '';
const stringSession = new StringSession(sessionString);
const client = new TelegramClient(stringSession, TG_API_ID, TG_API_HASH, {
  connectionRetries: 5,
});
let codeResolver;

const videoFileCache = new Map();

const FLASH_CODE_INPUT_ERROR = 'codeInputError'
const FLASH_TG_LINK_INPUT_ERROR = 'tgLinkInputError'

async function init() {
  await client.connect()
}

async function checkLogin() {
  try {
    const me = await client.getMe()
    console.log('Logged In, User: ', me.username || me.phone)
    return true
  } catch (error) {
    console.log('Client Not Logged In: ', error.message);
    return false
  }
}

exports.index = async (req, res) => {
  if (!await checkLogin()) {
    res.redirect('/tg/login')
    return
  }

  res.render('tg/index')
}

exports.video = async (req, res) => {
  if (!await checkLogin()) {
    res.redirect('/tg/login')
    return
  }

  const fileId = req.query?.fileId?.trim()
  if (!fileId || !videoFileCache.has(fileId)) {
    return res.status(400).json({ error: 'file not exist' });
  }

  const fileData = videoFileCache.get(fileId)
  const { loc: fileLocation, size: fileSize } = fileData

  const rangeHeader = req.headers.range;
  let start = 0;
  let end = fileSize - 1;

  if (rangeHeader) {
    const matches = rangeHeader.match(/bytes=(\d+)-(\d+)?/);
    if (matches) {
      start = parseInt(matches[1], 10);
      if (matches[2]) {
        end = parseInt(matches[2], 10);
      }
    }
  }

  if (start >= fileSize) {
    console.log('Request Range out of file size, stop transferring.');
    res.writeHead(416, { 'Content-Range': `bytes */${fileSize}` });
    res.end();
    return;
  }

  const tgChunkSize = 512 * 1024;
  let startBatchSize = start % tgChunkSize
  const tgStart = start - startBatchSize
  end = Math.min(end, fileSize - 1);

  const reqChunkSize = end - start + 1;
  console.log(`Reading file range: ${start} - ${end} (size: ${reqChunkSize})`);

  if (reqChunkSize <= 0) {
    console.log('Invalid chunkSize, stop transferring.');
    res.writeHead(416, { 'Content-Range': `bytes */${fileSize}` });
    res.end();
    return;
  }

  res.writeHead(206, {
    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
    'Accept-Ranges': 'bytes',
    'Content-Length': reqChunkSize,
    'Content-Type': 'video/mp4',
  });


  let ifNotClosed = true;
  req.on('close', () => {
    console.log('User stop the request, stop transferring.');
    ifNotClosed = false;
  });

  /** @type {Api.upload.File} **/
  let firstFileChunk = await client.invoke(
    new Api.upload.GetFile({
      location: fileLocation,
      offset: tgStart,
      limit: tgChunkSize,
      precise: true,
      cdnSupported: false,
    })
  );
  let firstData = firstFileChunk.bytes.subarray(startBatchSize)
  res.write(firstData)
  console.log('offset', tgStart, 'len', firstFileChunk.bytes.length)

  let offset = tgStart + tgChunkSize;
  while (ifNotClosed && offset <= end) {
    console.log('offset', offset, 'end', end)

    try {
      /** @type {Api.upload.File} **/
      let fileChunk = await client.invoke(
        new Api.upload.GetFile({
          location: fileLocation,
          offset: offset,
          limit: tgChunkSize,
          precise: true,
          cdnSupported: false,
        })
      );

      if (!fileChunk.bytes || fileChunk.bytes.length === 0) {
        break; // Finished
      }

      res.write(fileChunk.bytes);
      console.log('offset', offset, 'len', fileChunk.bytes.length)
      offset += fileChunk.bytes.length;
    } catch (err) {
      console.error('Read File error:', err);
      if (err instanceof RPCError && err.errorMessage === 'FILE_REFERENCE_EXPIRED') {
        videoFileCache.delete(fileId)
        console.warn(`${fileId} expired`)
      }
      break;
    }
  }

  res.end();
  console.log('Video streaming completed');
}

exports.login = async (req, res) => {
  if (await checkLogin()) {
    res.redirect('/tg/')
    return
  }
  try {
    res.render('tg/code_input', {
      error: req.flash(FLASH_CODE_INPUT_ERROR),
    })
    await client.start({
      phoneNumber: process.env.TG_PHONE,
      password: process.env.TG_PASSWORD,
      phoneCode: async () =>
        new Promise((resolve) => {
          codeResolver = resolve
        }),
      onError: (err) => {
        req.flash(FLASH_CODE_INPUT_ERROR, err.message)
        console.log(err)
      },
    })
    fs.writeFileSync('session.txt', client.session.save());
    codeResolver = null
  } catch (error) {
    console.error('Login to telegram error: ', error);
    res.status(500).json({ error: 'Login Failed' });
  }
}

exports.code = async (req, res) => {
  if (await checkLogin()) {
    res.redirect('/tg/')
    return
  }
  const code = req.body?.code?.trim()
  if (!code || !codeResolver) {
    return res.status(400).json({ error: 'code missing' });
  }
  await codeResolver(code)
  res.redirect('/tg/')
}

exports.connect = async (req, res) => {
  const tgLink = req.body?.tgLink?.trim()
  if (!tgLink) {
    return res.status(400).json({ error: 'tgLink missing' });
  }

  const urlParts = tgLink.replace('https://t.me/', '').split('/');
  const channelUsername = urlParts[0];
  const messageId = parseInt(urlParts[1], 10);

  try {
    const channel = await client.getEntity(channelUsername);
    const message = (await client.getMessages(channel, { ids: messageId }))[0];

    if (!message.media?.document) {
      console.log('No video')
      req.flash(FLASH_TG_LINK_INPUT_ERROR, 'No video')
      res.redirect('/tg/')
      return
    }
    console.log('Found media, start downloading...');

    const file = message.media.document;
    const fileSize = file.size;
    console.log('Video file_id:', file.id, 'video size (bytes):', fileSize);
    const fileLocation = new Api.InputDocumentFileLocation({
      id: file.id,
      accessHash: file.accessHash,
      fileReference: file.fileReference,
      thumbSize: '',
    });

    const fileIdStr = file.id.value.toString()
    videoFileCache.set(fileIdStr, {
      loc: fileLocation,
      size: fileSize,
    });

    res.redirect(url.format({
      pathname:'/tg/video',
      query: {
        'fileId': fileIdStr,
      }
    }))

  } catch (error) {
    console.error('Fetch message failed:', error);
  }
}

exports.list = async (req, res) => {
  const list = Array.from(videoFileCache.keys()).map(id => { return {'id': id} })
  console.log('list: ', list.length)
  res.json(list)
}


init()
  .then(/* Empty */)