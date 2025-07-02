import express from 'express';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mime from 'mime-types';
import { QueueManager } from 'queue-manager-async';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const queueManager = new QueueManager();

const app = express();
const port = process.env.PORT || 3000;

// CORS middleware for all routes
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.post('/ktx2', async (req, res) => {
  const chunksPromise = new Promise((resolve, reject) => {
    // Read raw body chunks manually
    const chunks = [];
    req.on('data', (chunk) => {
      chunks.push(chunk);
    });
    
    req.on('end', async () => {
      const imageBuffer = Buffer.concat(chunks);
      resolve(imageBuffer);
    });

    req.on('error', (error) => {
      reject(error);
    });
  });

  try {
    await queueManager.waitForTurn(async () => {
      const imageBuffer = await chunksPromise;

      const tempDir = await fs.mkdtemp(path.join(__dirname, 'temp-'));
      
      // Get the content-type and determine the file extension
      const contentType = req.get('content-type');
      const extension = mime.extension(contentType) || 'png'; // fallback to png if unknown
      const inputPath = path.join(tempDir, `image.${extension}`);
      const outputPath = path.join(tempDir, 'image.ktx2');
      
      console.log('got body', imageBuffer.length, 'bytes');
      await fs.writeFile(inputPath, imageBuffer);
      
      const basisuPath = path.join(__dirname, 'bin', 'basisu');
      
      // Parse quality parameter from query string
      const quality = parseInt(req.query.q, 10);
      const isValidQuality = !isNaN(quality) && quality >= 1 && quality <= 255;

      const flipY = req.query.flipY === '1';
      const uastc = req.query.uastc === '1';
      const mipmaps = req.query.mipmaps === '1';
      
      const args = [
        '-ktx2',
        inputPath,
        '-output_file',
        outputPath
      ];
      
      // Add quality parameter if valid
      if (isValidQuality) {
        args.push('-q', quality.toString());
      }

      if (flipY) {
        args.push('-y_flip');
      }

      if (uastc) {
        args.push('-uastc');
      }

      if (mipmaps) {
        args.push('-mipmap');
      }

      console.log('shelling out to basisu', [basisuPath, ...args]);
      
      const child = spawn(basisuPath, args);
      
      let stderr = '';
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('close', async (code) => {
        try {
          if (code !== 0) {
            console.error(`basisu exited with code ${code}: ${stderr}`);
            return res.status(500).json({ error: 'Compression failed', details: stderr });
          }
          
          const outputBuffer = await fs.readFile(outputPath);

          console.log('output buffer size', outputBuffer.length);

          res.set('Content-Type', 'application/octet-stream');
          res.send(outputBuffer);
        } catch (error) {
          console.error('Error reading output file:', error);
          res.status(500).json({ error: 'Failed to read compressed file' });
        }
      });
      
      child.on('error', async (error) => {
        console.error('Error spawning basisu:', error);
        res.status(500).json({ error: 'Failed to execute basisu binary' });
      });
    });
  } catch (error) {
    console.error('Error in /ktx2 endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(port, (error) => {
  if (!error) {
    console.log(`Server running on port ${port}`);
  } else {
    console.error('Error starting server:', error);
  }
});