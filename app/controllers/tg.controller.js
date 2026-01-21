const { RPCError } = require('telegram/errors');
const url = require('node:url');
const dayjs = require('dayjs');

const { startLogin, submitCode, getClient } = require('../services/tg_client')
const tgService = require('../services/tg_service')
const db = require('../models')
const { TG_CHUNK_SIZE } = tgService

const TelegramSession = db.TelegramSession
const TgAbbr = db.TgAbbr

const FLASH_CODE_INPUT_ERROR = 'codeInputError'
const FLASH_TG_LOGIN_ERROR = 'tgLoginError'
const FLASH_TG_LINK_INPUT_ERROR = 'tgLinkInputError'

async function ensureTelegramClient(userId) {
  const client = await getClient(userId)
  if (!client) {
    throw new Error('Telegram account not connected')
  }
  return client
}


exports.index = async (req, res) => {
  const history = await tgService.listVideoHistory(req.user.id)
  const toShowHistory = history.map(record => {
    const plain = record.get({plain: true});
    return {
      ...plain,
      createdAt: dayjs(plain.createdAt).format('YYYY-MM-DD HH:mm'),
      lastViewedAt: dayjs(plain.lastViewedAt).format('YYYY-MM-DD HH:mm')
    }
  })
  const abbrs = await TgAbbr.findAll()
  res.render('tg/index', {
    history: toShowHistory,
    abbrs: abbrs.map(a => a.get({ plain: true })),
  })
}

exports.video = async (req, res) => {
  const idRaw = req.query?.id?.trim()
  const id = Number.parseInt(idRaw, 10)
  const client = await ensureTelegramClient(req.user.id)
  const fileData = await tgService.getVideoCache(client, req.user.id, id, true)
  if (!fileData) {
    return res.status(400).json({ error: 'file not exist' });
  }

  const { size: fileSize } = fileData

  const rangeHeader = req.headers.range;
  let start = 0;
  let end = fileSize - 1;

  if (rangeHeader) {
    const matches = rangeHeader.match(/bytes=(\d+)-(\d+)?/);
    if (matches?.[1]) {
      start = Number.parseInt(matches[1], 10);
      if (matches?.[2] !== undefined) {
        end = Number.parseInt(matches[2], 10);
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

  let streamOpen = true;
  req.on('aborted', () => {
    console.log('Client aborted request, stop transferring.')
    streamOpen = false
  })
  req.on('close', () => {
    if (!res.writableEnded) {
      console.log('User stop the request, stop transferring.');
      streamOpen = false;
    }
  });

  try {
    let firstFileChunk = await tgService.getFileChunk(client, req.user.id, id, tgStart)
    let firstData = firstFileChunk.bytes.subarray(startBatchSize)
    res.write(firstData)
    console.log('offset', tgStart, 'len', firstFileChunk.bytes.length)

    let offset = tgStart + TG_CHUNK_SIZE;
    while (streamOpen && offset <= end) {
      console.log('offset', offset, 'end', end)

      let fileChunk = await tgService.getFileChunk(client, req.user.id, id, offset)

      if (!fileChunk.bytes || fileChunk.bytes.length === 0) {
        break; // Finished
      }

      res.write(fileChunk.bytes);
      console.log('offset', offset, 'len', fileChunk.bytes.length)
      offset += fileChunk.bytes.length;
    }
  } catch (err) {
    if (err instanceof RPCError && err.errorMessage === 'FILE_REFERENCE_EXPIRED') {
      tgService.deleteVideoCache(req.user.id, id)
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
  const id = Number.parseInt(idRaw, 10)
  const client = await ensureTelegramClient(req.user.id)
  const fileData = await tgService.getVideoCache(client, req.user.id, id)
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
  const pending = req.session?.pendingTelegramLogin
  const existingSession = await TelegramSession.findOne({ where: { user_id: req.user.id } })

  res.render('tg/login', {
    error: req.flash(FLASH_TG_LOGIN_ERROR),
    phoneNumber: pending?.phoneNumber || existingSession?.phoneNumber || '',
  })
}

exports.requestCode = async (req, res) => {
  const phoneNumber = req.body?.phoneNumber?.trim()
  const password = req.body?.password?.trim()

  if (!phoneNumber) {
    req.flash(FLASH_TG_LOGIN_ERROR, 'Phone number is required')
    return res.redirect('/tg/login')
  }

  try {
    await startLogin(req.user.id, phoneNumber, password)
    req.session.pendingTelegramLogin = { phoneNumber }
    res.redirect('/tg/code')
  } catch (error) {
    console.error('Telegram Login Error:', error.message)
    req.flash(FLASH_TG_LOGIN_ERROR, error.message)
    res.redirect('/tg/login')
  }
}

exports.codeInput = (req, res) => {
  const pending = req.session?.pendingTelegramLogin
  if (!pending) {
    return res.redirect('/tg/login')
  }

  res.render('tg/code_input', {
    error: req.flash(FLASH_CODE_INPUT_ERROR),
    phoneNumber: pending.phoneNumber,
  })
}

exports.resolveCode = async (req, res) => {
  if (!req.session?.pendingTelegramLogin) {
    req.flash(FLASH_CODE_INPUT_ERROR, 'Please request a login code first')
    return res.redirect('/tg/login')
  }

  const code = req.body?.code?.trim()
  if (!code) {
    req.flash(FLASH_CODE_INPUT_ERROR, 'Code missing')
    return res.redirect('/tg/code')
  }
  try {
    await submitCode(req.user.id, code)
    if (req.session) {
      delete req.session.pendingTelegramLogin
    }
    res.redirect('/tg/');
  } catch (error) {
    console.error('Submit Telegram Code Error:', error.message)
    req.flash(FLASH_CODE_INPUT_ERROR, error.message)
    res.redirect('/tg/code')
  }
}

exports.connect = async (req, res) => {
  const tgLink = req.body?.tgLink?.trim()
  if (!tgLink) {
    return res.status(400).json({ error: 'tgLink missing' });
  }

  const history = await tgService.getVideoHistoryByTgUrl(req.user.id, tgLink)
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
    const client = await ensureTelegramClient(req.user.id)
    const message = await tgService.getMessageFromLink(client, tgLink)
    const document = tgService.extractVideoDocument(message)

    if (!document) {
      console.log('No video')
      req.flash(FLASH_TG_LINK_INPUT_ERROR, 'No video')
      res.redirect('/tg/')
      return
    }

    const [ history ] = await tgService.buildVideo(req.user.id, document, tgLink)

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
  const nsfw = req.body?.nsfw
  const list = await tgService.listVideoHistory(req.user.id, nsfw)
  res.json(list)
}

exports.edit = async (req, res) => {
  const id = req.params.id
  try {
    const history = await tgService.updateHistory(id, req.user.id, req.body)
    res.send(history)
  } catch (err) {
    res.status(404).send(err.message)
  }
}

exports.delete = async (req, res) => {
  const id = req.params.id
  await tgService.removeRecord(id, req.user.id)
  res.redirect('/tg/');
}

exports.createAbbr = async (req, res) => {
  const { abbrRule, displayRule } = req.body
  if (!abbrRule || !displayRule) {
    return res.status(400).send('abbrRule and displayRule are required')
  }
  await TgAbbr.create({ abbrRule, displayRule })
  res.redirect('/tg/')
}

exports.updateAbbr = async (req, res) => {
  const id = req.params.id
  const { abbrRule, displayRule } = req.body
  const abbr = await TgAbbr.findByPk(id)
  if (!abbr) {
    return res.status(404).send('Abbr not found')
  }
  abbr.abbrRule = abbrRule
  abbr.displayRule = displayRule
  await abbr.save()
  res.redirect('/tg/')
}

exports.deleteAbbr = async (req, res) => {
  const id = req.params.id
  await TgAbbr.destroy({ where: { id } })
  res.redirect('/tg/')
}
