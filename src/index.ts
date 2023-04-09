import fs from 'fs'
import fse from 'fs-extra'
import ffmpeg from 'fluent-ffmpeg'

const inputChunkSizeMB = 10

async function splitAudioFile(inputFile: string, outputFolder: string, chunkSizeMB: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    // Get metadata of the audio file
    ffmpeg.ffprobe(inputFile, (err, metadata) => {
      if (err) {
        console.error("Error while reading metadata:", err);
        reject(err);
        return;
      }

      const duration = metadata.format.duration as number;
      const bitrate = metadata.format.bit_rate as number  ; // bps
      const chunkSizeBytes = chunkSizeMB * 1024 * 1024; // bytes
      const chunkLengthSeconds = (chunkSizeBytes * 8) / bitrate; // sec
      const numChunks = Math.ceil(duration / chunkLengthSeconds);
      let chunksProcessed = 0;

      for (let i = 0; i < numChunks; i++) {
        let startTime = i * chunkLengthSeconds;
        const fileName = inputFile.split('/')[inputFile.split('/').length - 1].split('.')[0];
        const outputFile = `${outputFolder}/${fileName}-${i + 1}.mp3`;

        ffmpeg(inputFile)
          .setStartTime(startTime)
          .setDuration(chunkLengthSeconds)
          .output(outputFile)
          .outputOptions("-map_metadata", "-1") // Remove metadata from output
          .on("start", () => {
            console.log(`Starting chunk ${i + 1}`);
          })
          .on("end", () => {
            console.log(`Finished chunk ${i + 1}`);
            chunksProcessed++;
            if (chunksProcessed === numChunks) {
              resolve();
            }
          })
          .on("error", (err) => {
            console.error(`Error during processing chunk ${i + 1}:`, err);
            reject(err);
          })
          .run();
      }
    });
  });
}

async function main() {
  if (!fs.existsSync('./results')) {
    fs.mkdirSync('./results')
  } else {
    fse.emptyDir('./results')
  }

  const files = fs.readdirSync('./resources')

  for (const fileName of files) {
    console.log('Starting', fileName)

    const targetFilePath = `./resources/${fileName}`

    await splitAudioFile(targetFilePath, `./results` , inputChunkSizeMB)

    console.log('Finished', fileName)
  }
}

main()