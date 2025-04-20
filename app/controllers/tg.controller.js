const { RPCError } = require('telegram/errors');
const url = require('url');
const dayjs = require('dayjs');

const { client, startLogin, submitCode } = require('../services/tg_client')
const tgService = require('../services/tg_service')
const { TG_CHUNK_SIZE } = tgService

const FLASH_CODE_INPUT_ERROR = 'codeInputError'
const FLASH_TG_LINK_INPUT_ERROR = 'tgLinkInputError'


exports.index = async (req, res) => {
  const history = await tgService.listVideoHistory()
  const toShowHistory = history.map(record => {
    const plain = record.get({plain: true});
    return {
      ...plain,
      createdAt: dayjs(plain.createdAt).format('YYYY-MM-DD HH:mm'),
      lastViewedAt: dayjs(plain.lastViewedAt).format('YYYY-MM-DD HH:mm')
    }
  })
  res.render('tg/index', {
    history: toShowHistory,
  })
}

exports.video = async (req, res) => {
  const idRaw = req.query?.id?.trim()
  const id = parseInt(idRaw, 10)
  const fileData = await tgService.getVideoCache(id, true)
  if (!fileData) {
    return res.status(400).json({ error: 'file not exist' });
  }

  const { size: fileSize } = fileData

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

  let startBatchSize = start % TG_CHUNK_SIZE
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

  try {
    let firstFileChunk = await tgService.getFileChunk(id, tgStart)
    let firstData = firstFileChunk.bytes.subarray(startBatchSize)
    res.write(firstData)
    console.log('offset', tgStart, 'len', firstFileChunk.bytes.length)

    let offset = tgStart + TG_CHUNK_SIZE;
    while (ifNotClosed && offset <= end) {
      console.log('offset', offset, 'end', end)

      let fileChunk = await tgService.getFileChunk(id, offset)

      if (!fileChunk.bytes || fileChunk.bytes.length === 0) {
        break; // Finished
      }

      res.write(fileChunk.bytes);
      console.log('offset', offset, 'len', fileChunk.bytes.length)
      offset += fileChunk.bytes.length;
    }
  } catch (err) {
    if (err instanceof RPCError && err.errorMessage === 'FILE_REFERENCE_EXPIRED') {
      tgService.deleteVideoCache(id)
      console.warn(`${id} expired`)
    } else {
      console.error('Read File error:', err);
    }
  }

  res.end();
  console.log('Video streaming completed');
}

exports.videoThumbnail = async (req, res) => {
  const idRaw = req.query?.id?.trim()
  const id = parseInt(idRaw, 10)
  const fileData = await tgService.getVideoCache(id)
  if (!fileData) {
    return res.status(400).json({ error: 'file not exist' });
  }
  const { tLoc: fileLocation, dcId: dcId } = fileData

  const buffer = await client.downloadFile(fileLocation, {
    dcId: dcId,
  });

  res.set('Content-Type', 'image/jpeg')
  res.send(Buffer.from(buffer))
}

exports.login = async (req, res) => {
  try {
    res.render('tg/code_input', {
      error: req.flash(FLASH_CODE_INPUT_ERROR),
    })
    await startLogin(null, (err) => {
      req.flash(FLASH_CODE_INPUT_ERROR, err.message);
      console.error('Telegram Login Error:', err.message);
    });

    res.redirect('/tg/');
  } catch (error) {
    console.error('Login to telegram error: ', error);
    res.status(500).json({ error: 'Login Failed' });
  }
}

exports.code = async (req, res) => {
  const code = req.body?.code?.trim()
  if (!code) {
    return res.status(400).json({ error: 'code missing' });
  }
  await submitCode(code);
  res.redirect('/tg/');
}

exports.connect = async (req, res) => {
  const tgLink = req.body?.tgLink?.trim()
  if (!tgLink) {
    return res.status(400).json({ error: 'tgLink missing' });
  }

  const history = await tgService.getVideoHistoryByTgUrl(tgLink)
  if (history) {
    res.redirect(url.format({
      pathname:'/tg/video',
      query: {
        'id': history.id,
      }
    }))
    return
  }

  try {
    const message = await tgService.getMessageFromLink(tgLink)
    const document = tgService.extractVideoDocument(message)

    if (!document) {
      console.log('No video')
      req.flash(FLASH_TG_LINK_INPUT_ERROR, 'No video')
      res.redirect('/tg/')
      return
    }

    const [ history, _] = await tgService.buildVideo(document, tgLink)

    res.redirect(url.format({
      pathname:'/tg/video',
      query: {
        'id': history.id,
      }
    }))

  } catch (error) {
    console.error('Fetch message failed:', error);
  }
}

exports.list = async (req, res) => {
  const list = await tgService.listVideoHistory()
  res.json(list)
}

exports.delete = async (req, res) => {
  const id = req.body?.id?.trim()
  await tgService.removeRecord(id)
  res.redirect('/tg/');
}
