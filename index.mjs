import express from 'express';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mime from 'mime-types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  let tempDir;
  
  try {
    // Read raw body chunks manually
    const chunks = [];
    req.on('data', (chunk) => {
      chunks.push(chunk);
    });
    
    req.on('end', async () => {
      try {
        tempDir = await fs.mkdtemp(path.join(__dirname, 'temp-'));
        
        // Concatenate all chunks into a single buffer
        const imageBuffer = Buffer.concat(chunks);
        
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
        
        const args = [
          '-ktx2',
          '-mipmap',
          inputPath,
          '-output_file',
          outputPath
        ];
        
        // Add quality parameter if valid
        if (isValidQuality) {
          args.push('-q', quality.toString());
        }
        
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
          } finally {
            // Cleanup temp directory
            if (tempDir) {
              try {
                await fs.rm(tempDir, { recursive: true, force: true });
              } catch (cleanupError) {
                console.error('Error cleaning up temp directory:', cleanupError);
              }
            }
          }
        });
        
        child.on('error', async (error) => {
          console.error('Error spawning basisu:', error);
          res.status(500).json({ error: 'Failed to execute basisu binary' });
        });
        
      } catch (error) {
        console.error('Error in /ktx2 endpoint:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });
    
    req.on('error', (error) => {
      console.error('Error reading request body:', error);
      res.status(500).json({ error: 'Failed to read request body' });
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