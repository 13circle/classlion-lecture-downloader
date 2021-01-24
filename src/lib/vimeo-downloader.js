// Originial code from:
// https://gist.github.com/mistic100/895f6d17b1e193334882a4c37d0d7748

import fs from 'fs';
import url from 'url';
import https from 'https';
import path from 'path';
import { execSync } from 'child_process';

const tmpDir = path.join(process.cwd(), 'tmp');
const outputDir = path.join(process.cwd(), 'videos');

function main(inputJson) {
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir);
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  inputJson.forEach(input => {
    let masterUrl = input.masterJsonUrl;

    if (!masterUrl.endsWith('?base64_init=1')) {
      masterUrl += '?base64_init=1';
    }

    getJson(masterUrl, (err, json) => {
      if (err) {
        throw err;
      }
      
      const videoData = json.video.pop();
      const audioData = json.audio.pop();
      
      const videoBaseUrl = url.resolve(url.resolve(masterUrl, json.base_url), videoData.base_url);
      const audioBaseUrl = url.resolve(url.resolve(masterUrl, json.base_url), audioData.base_url);

      const { videoFile, audioFile, outputFile } = handleFilePaths(`${input.fileName}-${json.clip_id}`);

      if (videoFile && audioFile && outputFile) {
        processFile('video', videoBaseUrl, videoData.init_segment, videoData.segments, videoFile, (err) => {
          if (err) {
            throw err;
          }
          
          processFile('audio', audioBaseUrl, audioData.init_segment, audioData.segments, audioFile, (err) => {
            if (err) {
              throw err;
            }

            mergeToMP4(videoFile, audioFile, outputFile);

            removeTmpFiles(videoFile, audioFile);
          });
        });
      }
    });
  });
}

function handleFilePaths(fileName) {
  const videoFile = path.join(tmpDir, `${fileName}.m4v`);
  const audioFile = path.join(tmpDir, `${fileName}.m4a`);
  const outputFile = path.join(outputDir, `${fileName}.mp4`);

  if (fs.existsSync(outputFile)) {
    console.log(`Duplicate video: you already have ${outputFile}.`);
    return {};
  }

  return {
    videoFile,
    audioFile,
    outputFile,
  };
}

function mergeToMP4(videoFile, audioFile, outputFile) {
  execSync(`ffmpeg -i "${videoFile}" -i "${audioFile}" -c:v copy -c:a copy "${outputFile}"`);
  console.log(`DONE: "${outputFile}" merged successfully`);
}

function removeTmpFiles(videoFile, audioFile) {
  fs.unlinkSync(videoFile);
  fs.unlinkSync(audioFile);
}

function processFile(type, baseUrl, initData, segments, fileName, cb) {
  const segmentsUrl = segments.map((seg) => baseUrl + seg.url);
  
  const initBuffer = Buffer.from(initData, 'base64');
  fs.writeFileSync(fileName, initBuffer);
  
  const output = fs.createWriteStream(fileName, {flags: 'a'});
  
  combineSegments(fileName, type, 0, segmentsUrl, output, (err) => {
    if (err) {
      return cb(err);
    }
    
    output.end();
    cb();
  });
}

function combineSegments(fileName, type, i, segmentsUrl, output, cb) {
  const max = segmentsUrl.length;

  if (i >= max) {
    console.log(`DONE: ${type} file for ${fileName}`);
    return cb();
  }
  
  console.log(`Download ${type} segment of "${fileName}" (${i}/${max})`);
  
  https.get(segmentsUrl[i], (res) => {
    res.on('data', (d) => output.write(d));
    
    res.on('end', () => combineSegments(fileName, type, i+1, segmentsUrl, output, cb));
    
  }).on('error', (e) => {
    cb(e);
  });
}

function getJson(url, cb) {
  let data = '';
  
  https.get(url, (res) => {
    res.on('data', (d) => data+= d);
    
    res.on('end', () => cb(null, JSON.parse(data)));

  }).on('error', (e) => {
    cb(e);
  });
}

export default main;

