const { Api } = require('telegram')

const TG_CHUNK_SIZE = 512 * 1024

const db = require('../models')
const TgViewedHistory = db.TgViewedHistory
const videoFileCache = new Map();

function getCacheKey(userId, historyId) {
  return `${userId}:${historyId}`
}

async function getMessageFromLink(client, tgLink) {
  const [channelName, msgIdStr] = tgLink.replace('https://t.me/', '').split('/');
  const channel = await client.getEntity(channelName);
  return (await client.getMessages(channel, {ids: Number.parseInt(msgIdStr, 10)}))[0];
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

async function buildVideo(userId, document, messageUrl) {
  const [history] = await TgViewedHistory.findOrCreate({
    where: { messageUrl: messageUrl, userId },
    defaults: { userId },
  })

  const cache = buildVideoCache(document)

  // Update filename and duration
  history.filename = cache.filename;
  history.duration = cache.duration;
  history.userId = userId
  await history.save();

  videoFileCache.set(getCacheKey(userId, history.id), cache)
  return [history, cache]
}

async function getVideoCache(client, userId, id, toView = false) {
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
  const key = getCacheKey(userId, id)
  if (videoFileCache.has(key)) {
    return videoFileCache.get(key)
  }
  const message = await getMessageFromLink(client, history.messageUrl)
  const document = extractVideoDocument(message)
  const [_, cache] = await buildVideo(userId, document, history.messageUrl)
  return cache
}

function deleteVideoCache(userId, id) {
  videoFileCache.delete(getCacheKey(userId, id))
}

async function listVideoHistory(userId, nsfw = false) {
  const where = { userId };
  if (nsfw === true) {
    where.nsfw = false;
  }
  return await TgViewedHistory.findAll({
    where,
    order: [['lastViewedAt', 'DESC']]
  })
}

async function getVideoHistoryByTgUrl(userId, tgUrl) {
  return await TgViewedHistory.findOne({
    where: { messageUrl: tgUrl, userId }
  })
}

async function getFileChunk(client, userId, historyId, offset) {
  let cache = videoFileCache.get(getCacheKey(userId, historyId))
  if (!cache) {
    cache = await getVideoCache(client, userId, historyId)
  }
  if (!cache) {
    throw new Error('File cache not found for requested video')
  }
  const { dcId, loc } = cache
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

async function updateHistory(historyId, userId, updates = {}) {
  const record = await TgViewedHistory.findOne({ where: { id: historyId, userId } })
  if (!record) throw new Error('Record not found')

  if ('nsfw' in updates) {
    record.nsfw = updates.nsfw === true || updates.nsfw === 'true'
  }
  if ('title' in updates) {
    record.title = updates.title
  }

  await record.save()
  return record
}

async function removeRecord(historyId, userId) {
  deleteVideoCache(userId, historyId)
  await TgViewedHistory.destroy({
    where: {id: historyId, userId}
  })
}

module.exports = {
  TG_CHUNK_SIZE,

  getMessageFromLink,
  extractVideoDocument,

  buildVideo,
  getVideoCache,
  deleteVideoCache,

  listVideoHistory,
  getVideoHistoryByTgUrl,

  getFileChunk,

  updateHistory,
  removeRecord,
}
