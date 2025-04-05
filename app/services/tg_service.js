const { Api } = require('telegram')
const { client } = require('./tg_client')

const TG_CHUNK_SIZE = 512 * 1024

const db = require('../models')
const TgViewedHistory = db.TgViewedHistory
const videoFileCache = new Map();

async function getMessageFromLink(tgLink) {
  const [channelName, msgIdStr] = tgLink.replace('https://t.me/', '').split('/');
  const channel = await client.getEntity(channelName);
  return (await client.getMessages(channel, {ids: parseInt(msgIdStr, 10)}))[0];
}

function extractVideoDocument(message) {
  const document = message.media?.document;
  const isVideo = document?.attributes.some(attr => attr instanceof Api.DocumentAttributeVideo);
  return isVideo ? document : null;
}

function buildFileLocation(document, thumbSize) {
  return new Api.InputDocumentFileLocation({
    id: document.id,
    accessHash: document.accessHash,
    fileReference: document.fileReference,
    thumbSize: thumbSize,
  })
}

function getVideoLocation(document) { return buildFileLocation(document, '') }
function getThumbnailLocation(document) { return buildFileLocation(document, document.thumbs?.[1]?.type) }

function buildVideoCache(document) {
  const fileSize = document.size;
  console.log('Video file_id:', document.id, 'video size (bytes):', fileSize);
  const videoFileLocation = getVideoLocation(document)
  const thumbFileLocation = getThumbnailLocation(document)
  const filename = document.attributes.find(attr => attr instanceof Api.DocumentAttributeFilename)?.fileName
  const duration = document.attributes.find(attr => attr instanceof Api.DocumentAttributeVideo)?.duration
  return {
    loc: videoFileLocation,
    tLoc: thumbFileLocation,
    size: fileSize,
    filename: filename || '',
    duration: duration || 0,
    dcId: document.dcId,
  }
}

async function buildVideo(document, messageUrl) {
  const [history] = await TgViewedHistory.findOrCreate({
    where: { messageUrl: messageUrl },
  })

  const cache = buildVideoCache(document)
  videoFileCache.set(history.id, cache)
  return [history, cache]
}

function listVideoCache() {
  return Array.from(videoFileCache.entries()).map(([id, item]) => {
    return {
      'id': id,
      'filename': item.filename,
      'duration': item.duration,
    }
  })
}

async function getVideoCache(id, toView = false) {
  const history = await TgViewedHistory.findOne({
    where: {id: id}
  })
  if (!history) {
    return null
  }
  if (toView) {
    history.updateLastViewed()
      .catch(console.error)
  }
  if (videoFileCache.has(id)) {
    return videoFileCache.get(id)
  }
  const message = await getMessageFromLink(history.messageUrl)
  const document = extractVideoDocument(message)
  const [_, cache] = await buildVideo(document, history.messageUrl)
  return cache
}

function deleteVideoCache(id) {
  videoFileCache.delete(id)
}

async function listVideoHistory() {
  return await TgViewedHistory.findAll({
    order: [['lastViewedAt', 'DESC']]
  })
}

async function getVideoHistoryByTgUrl(tgUrl) {
  return await TgViewedHistory.findOne({
    where: { messageUrl: tgUrl }
  })
}

async function getFileChunk(historyId, offset) {
  const { dcId, loc } = videoFileCache.get(historyId)
  const sender = await client.getSender(dcId);
  return await sender.send(
    new Api.upload.GetFile({
      location: loc,
      offset: offset,
      limit: TG_CHUNK_SIZE,
      precise: true,
      cdnSupported: false,
    })
  )
}

module.exports = {
  TG_CHUNK_SIZE,

  getMessageFromLink,
  extractVideoDocument,

  buildVideo,
  listVideoCache,
  getVideoCache,
  deleteVideoCache,

  listVideoHistory,
  getVideoHistoryByTgUrl,

  getFileChunk,
}