const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const videoDir = path.join(__dirname, '../../local_assets/video');
const thumbnailDir = path.join(__dirname, '../../local_assets/thumb')

exports.getAllVideos = (req, res) => {
  fs.readdir(videoDir, (err, files) => {
    if (err) {
      return res.status(500).send('Unable to read the video folder');
    }

    const videoFiles = files.filter(file => /\.(mp4|avi|mov|mkv)$/.test(file));

    res.render('browse_videos/index', { videos: videoFiles });
  });
};

exports.videoList = (req, res) => {
  fs.readdir(videoDir, (err, files) => {
    if (err) {
      return res.status(500).send('Unable to read the video folder');
    }
    const videoFiles = files.filter(file => /\.(mp4|avi|mov|mkv)$/.test(file));
    const result = videoFiles.map(videoName => {
      return {
        id: videoName,
        thumbnail: videoName,
      }
    })
    res.json(result);
  });
};

exports.streamVideo = (req, res) => {
  const { filename } = req.params;
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
  const { filename } = req.params;
  const videoPath = path.join(videoDir, filename);
  const thumbnailPath = path.join(thumbnailDir, `${filename}.jpg`);

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