const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const videoDir = path.join(__dirname, '../../local_assets/video');
const thumbnailDir = path.join(__dirname, '../../local_assets/thumb')

// A fresh server has no local_assets yet
fs.mkdirSync(videoDir, { recursive: true });
fs.mkdirSync(thumbnailDir, { recursive: true });

const VIDEO_EXT = /\.(mp4|avi|mov|mkv)$/i;

// Resolve a path relative to videoDir, returning null if it escapes videoDir
function resolveInVideoDir(relPath = '') {
  const resolved = path.resolve(videoDir, relPath);
  if (resolved !== videoDir && !resolved.startsWith(videoDir + path.sep)) {
    return null;
  }
  return resolved;
}

// Thumbnails mirror the video folder structure: thumb/<relPath>.jpg
function thumbnailPathOf(relPath) {
  return path.join(thumbnailDir, `${relPath}.jpg`);
}

function getLibraryTree(subDir) {
  const dir = path.join(videoDir, subDir)
  const result = [];
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    const relPath = subDir ? `${subDir}/${file}` : file;

    if (stat.isDirectory()) {
      result.push({
        name: file,
        type: 'folder',
        relPath,
        children: getLibraryTree(relPath),
      });
    } else if (VIDEO_EXT.test(file)) {
      result.push({
        name: file,
        type: 'video',
        relPath,
        thumbnail: `thumbnails/${relPath}`,
        path: `v/${relPath}`,
      });
    }
  });

  return result;
}

exports.index = (req, res) => {
  res.render('browse_library/index');
};

exports.itemList = (req, res) => {
  try {
    const data = getLibraryTree('')
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).send('Unable to read the video folder');
  }
};

exports.streamVideo = (req, res) => {
  const filename = req.params.filename.join('/')
  const filePath = resolveInVideoDir(filename);

  if (!filePath) {
    return res.status(400).json({ error: 'invalid path' });
  }
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'video not exist' });
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize) {
      res.status(416).send('Requested range not satisfiable');
      return;
    }

    const chunkSize = end - start + 1;
    const fileStream = fs.createReadStream(filePath, { start, end });

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': 'video/mp4',
    });

    fileStream.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4',
    });

    fs.createReadStream(filePath).pipe(res);
  }
};

exports.getThumbnail = async (req, res) => {
  const filename = req.params.filename.join('/')
  const videoPath = resolveInVideoDir(filename);
  const thumbnailPath = thumbnailPathOf(filename);

  if (!videoPath) {
    return res.status(400).send('invalid path');
  }
  if (!fs.existsSync(videoPath)) {
    return res.status(404).send('video not exist');
  }

  // if the thumbnail already exists
  if (fs.existsSync(thumbnailPath)) {
    return res.sendFile(thumbnailPath);
  }

  fs.mkdirSync(path.dirname(thumbnailPath), { recursive: true });

  exec(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`, (err, stdout) => {
    if (err) {
      console.error('Unable to read the video information', err);
      return res.status(500).send('Unable to generate thumbnail');
    }

    const duration = parseFloat(stdout);
    const snapshotTime = Math.max(1, duration * 0.25);

    exec(`ffmpeg -i "${videoPath}" -ss ${snapshotTime} -vframes 1 -q:v 2 "${thumbnailPath}" -y`, (err) => {
      if (err) {
        console.error('Thumbnail generate failed', err);
        return res.status(500).send('Unable to generate thumbnail');
      }
      res.sendFile(thumbnailPath);
    });
  });
};
exports.uploadVideos = (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  res.json({ uploaded: req.files.map(f => f.utf8Name || f.originalname) });
};

exports.deleteVideo = (req, res) => {
  const filename = req.params.filename.join('/')
  const filePath = resolveInVideoDir(filename);

  if (!filePath || filePath === videoDir || !VIDEO_EXT.test(filePath)) {
    return res.status(400).json({ error: 'invalid path' });
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return res.status(404).json({ error: 'video not exist' });
  }

  try {
    fs.unlinkSync(filePath);
    fs.rmSync(thumbnailPathOf(filename), { force: true });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to delete the video' });
  }
};

exports.createFolder = (req, res) => {
  const { dir = '', name = '' } = req.body || {};
  const folderName = String(name).trim();
  if (!folderName || folderName === '.' || folderName === '..' || /[\\/]/.test(folderName)) {
    return res.status(400).json({ error: 'invalid folder name' });
  }

  const parentPath = resolveInVideoDir(dir);
  if (!parentPath || !fs.existsSync(parentPath) || !fs.statSync(parentPath).isDirectory()) {
    return res.status(400).json({ error: 'invalid parent folder' });
  }

  const folderPath = path.join(parentPath, folderName);
  if (fs.existsSync(folderPath)) {
    return res.status(409).json({ error: 'folder already exists' });
  }

  try {
    fs.mkdirSync(folderPath);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to create the folder' });
  }
};

exports.deleteFolder = (req, res) => {
  const dirname = req.params.dirname.join('/')
  const folderPath = resolveInVideoDir(dirname);

  if (!folderPath || folderPath === videoDir) {
    return res.status(400).json({ error: 'invalid path' });
  }
  if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
    return res.status(404).json({ error: 'folder not exist' });
  }
  // hidden files such as .DS_Store don't count as content
  if (fs.readdirSync(folderPath).some(f => !f.startsWith('.'))) {
    return res.status(409).json({ error: 'folder is not empty' });
  }

  try {
    fs.rmSync(folderPath, { recursive: true });
    fs.rmSync(path.join(thumbnailDir, dirname), { recursive: true, force: true });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to delete the folder' });
  }
};

exports.videoDir = videoDir;
exports.VIDEO_EXT = VIDEO_EXT;
exports.resolveInVideoDir = resolveInVideoDir;
