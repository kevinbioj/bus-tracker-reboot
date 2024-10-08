import { createReadStream } from "node:fs";
import Papa from "papaparse";

export type CsvRecord<Required extends string = never, Optional extends string = never> = {
  [key in Required]: string;
} & { [key in Optional]?: string };

type ReadCsvOptions = {
  delimiter?: string;
  encoding?: BufferEncoding;
};

async function readFirstBytes(path: string, size: number) {
  const chunks = [];
  for await (const chunk of createReadStream(path, { start: 0, end: size - 1 })) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function readCsv<T extends CsvRecord<string>>(
  path: string,
  onRecord: (record: T) => void,
  { delimiter, encoding }: ReadCsvOptions = {},
) {
  const firstBytes = await readFirstBytes(path, 3);
  const hasBom = firstBytes.toString().charCodeAt(0) === 0xfeff;
  const readStream = createReadStream(path, { encoding, start: hasBom ? 3 : 0 });
  return new Promise<void>((resolve, reject) => {
    Papa.parse<T>(readStream, {
      complete: () => resolve(),
      delimiter,
      encoding,
      error: (error) => reject(error),
      header: true,
      skipEmptyLines: true,
      step: (results) => onRecord(results.data),
    });
  });
}
