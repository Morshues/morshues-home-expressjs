const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const videoDir = path.join(__dirname, '../../local_assets/video');
const thumbnailDir = path.join(__dirname, '../../local_assets/thumb')

function getLibraryTree(subDir) {
  const dir = path.join(videoDir, subDir)
  const result = [];
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      result.push({
        name: file,
        type: 'folder',
        children: getLibraryTree(path.join(subDir,file)),
      });
    } else if (/\.(mp4|avi|mov|mkv)$/.test(file)) {
      result.push({
        name: file,
        type: 'video',
        thumbnail: path.join('thumbnails',subDir,file),
        path: path.join('v',subDir,file),
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
  const filePath = path.join(videoDir, filename);

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
  const videoPath = path.join(videoDir, filename);
  const thumbnailName = req.params.filename.join(':')
  const thumbnailPath = path.join(thumbnailDir, `${thumbnailName}.jpg`);

  if (!fs.existsSync(videoPath)) {
    return res.status(404).send('video not exist');
  }

  // if the thumbnail already exists
  if (fs.existsSync(thumbnailPath)) {
    return res.sendFile(thumbnailPath);
  }

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