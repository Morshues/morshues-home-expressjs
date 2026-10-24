const { Api } = require('telegram')

const TG_CHUNK_SIZE = 512 * 1024

const db = require('../models')
const TgViewedHistory = db.TgViewedHistory
const TgAbbr = db.TgAbbr
const TgGroup = db.TgGroup
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

function serviceError(status, message) {
  const err = new Error(message)
  err.status = status
  return err
}

// '' / null / undefined mean "ungrouped"; otherwise the group must belong to the user
async function resolveGroupId(userId, groupId) {
  if (groupId === undefined || groupId === null || groupId === '' || groupId === 'null') {
    return null
  }
  const id = Number.parseInt(groupId, 10)
  const group = Number.isNaN(id) ? null : await TgGroup.findOne({ where: { id, userId } })
  if (!group) throw serviceError(404, 'Group not found')
  return group.id
}

async function buildVideo(userId, document, messageUrl, groupId = null) {
  const [history] = await TgViewedHistory.findOrCreate({
    where: { messageUrl: messageUrl, userId },
    defaults: { userId, groupId: await resolveGroupId(userId, groupId) },
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

  const histories = await TgViewedHistory.findAll({
    where,
    order: [['lastViewedAt', 'DESC']]
  })

  const abbrs = await TgAbbr.findAll()

  for (const history of histories) {
    for (const abbr of abbrs) {
      const regex = new RegExp(abbr.abbrRule, 'g')
      history.filename = history.filename.replace(regex, abbr.displayRule)
    }
  }

  return histories
}

// Groups (sorted by name, empty ones included) followed by ungrouped videos, like the library tree.
// Filtering out nsfw also hides nsfw groups together with every video in them.
async function listVideoTree(userId, nsfw = false) {
  const histories = await listVideoHistory(userId, nsfw)
  const groups = await listGroups(userId)
  const hiddenGroupIds = new Set()

  const groupNodes = new Map()
  for (const group of groups) {
    if (nsfw === true && group.nsfw) {
      hiddenGroupIds.add(group.id)
      continue
    }
    groupNodes.set(group.id, {
      type: 'group',
      id: group.id,
      name: group.name,
      nsfw: group.nsfw,
      children: [],
    })
  }
  const ungrouped = []

  for (const history of histories) {
    if (hiddenGroupIds.has(history.groupId)) continue
    const node = { type: 'video', ...history.get({ plain: true }) }
    const groupNode = groupNodes.get(history.groupId)
    if (groupNode) {
      groupNode.children.push(node)
    } else {
      ungrouped.push(node)
    }
  }

  return [...groupNodes.values(), ...ungrouped]
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
  if ('groupId' in updates) {
    record.groupId = await resolveGroupId(userId, updates.groupId)
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

function normalizeGroupName(name) {
  const groupName = String(name ?? '').trim()
  if (!groupName) throw serviceError(400, 'invalid group name')
  return groupName
}

async function saveGroup(group) {
  try {
    return await group.save()
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      throw serviceError(409, 'group name already exists')
    }
    throw err
  }
}

async function listGroups(userId) {
  return await TgGroup.findAll({
    where: { userId },
    order: [['name', 'ASC']],
  })
}

async function createGroup(userId, name) {
  return await saveGroup(TgGroup.build({ userId, name: normalizeGroupName(name) }))
}

async function updateGroup(groupId, userId, updates = {}) {
  const group = await TgGroup.findOne({ where: { id: groupId, userId } })
  if (!group) throw serviceError(404, 'Group not found')

  if ('name' in updates) {
    group.name = normalizeGroupName(updates.name)
  }
  if ('nsfw' in updates) {
    group.nsfw = updates.nsfw === true || updates.nsfw === 'true'
  }

  return await saveGroup(group)
}

// force: also delete the video records in the group; otherwise a non-empty group is a conflict
async function deleteGroup(groupId, userId, force = false) {
  const group = await TgGroup.findOne({ where: { id: groupId, userId } })
  if (!group) throw serviceError(404, 'Group not found')

  const videos = await TgViewedHistory.findAll({
    where: { groupId: group.id, userId },
    attributes: ['id'],
  })
  if (videos.length > 0 && !force) {
    throw serviceError(409, 'group is not empty')
  }

  await db.sequelize.transaction(async (transaction) => {
    await TgViewedHistory.destroy({ where: { groupId: group.id, userId }, transaction })
    await group.destroy({ transaction })
  })
  for (const video of videos) {
    deleteVideoCache(userId, video.id)
  }
  return videos.length
}

module.exports = {
  TG_CHUNK_SIZE,

  getMessageFromLink,
  extractVideoDocument,

  buildVideo,
  getVideoCache,
  deleteVideoCache,

  listVideoTree,
  getVideoHistoryByTgUrl,

  getFileChunk,

  updateHistory,
  removeRecord,

  listGroups,
  createGroup,
  updateGroup,
  deleteGroup,
}
