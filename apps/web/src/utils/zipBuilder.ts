const encodeUtf8 = (input: string): Uint8Array => new TextEncoder().encode(input);

const crc32Table = (() => {
  const table = new Uint32Array(256);

  for (let i = 0; i < 256; i += 1) {
    let crc = i;
    for (let j = 0; j < 8; j += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
    table[i] = crc >>> 0;
  }

  return table;
})();

const crc32 = (data: Uint8Array): number => {
  let crc = 0xffffffff;

  for (let i = 0; i < data.length; i += 1) {
    crc = crc32Table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
};

interface ZipEntryInput {
  path: string;
  data: string | Uint8Array;
  mimeType?: string;
}

const createLocalFileHeader = (entry: ZipEntryInput, offset: number, data: Uint8Array) => {
  const fileNameBytes = encodeUtf8(entry.path);
  const header = new DataView(new ArrayBuffer(30));

  header.setUint32(0, 0x04034b50, true); // local file header signature
  header.setUint16(4, 20, true); // version needed to extract
  header.setUint16(6, 0, true); // general purpose bit flag
  header.setUint16(8, 0, true); // compression method (store)
  header.setUint16(10, 0, true); // last mod file time
  header.setUint16(12, 0, true); // last mod file date
  header.setUint32(14, crc32(data), true);
  header.setUint32(18, data.length, true); // compressed size
  header.setUint32(22, data.length, true); // uncompressed size
  header.setUint16(26, fileNameBytes.length, true); // file name length
  header.setUint16(28, 0, true); // extra field length

  const bytes = new Uint8Array(header.byteLength + fileNameBytes.length + data.length);
  bytes.set(new Uint8Array(header.buffer), 0);
  bytes.set(fileNameBytes, header.byteLength);
  bytes.set(data, header.byteLength + fileNameBytes.length);

  return { bytes, fileNameBytes, offset, size: bytes.length };
};

const createCentralDirectoryRecord = (
  entry: ZipEntryInput,
  fileNameBytes: Uint8Array,
  localHeaderOffset: number,
  data: Uint8Array,
) => {
  const header = new DataView(new ArrayBuffer(46));

  header.setUint32(0, 0x02014b50, true); // central file header signature
  header.setUint16(4, 20, true); // version made by
  header.setUint16(6, 20, true); // version needed to extract
  header.setUint16(8, 0, true); // general purpose bit flag
  header.setUint16(10, 0, true); // compression method
  header.setUint16(12, 0, true); // last mod file time
  header.setUint16(14, 0, true); // last mod file date
  header.setUint32(16, crc32(data), true);
  header.setUint32(20, data.length, true); // compressed size
  header.setUint32(24, data.length, true); // uncompressed size
  header.setUint16(28, fileNameBytes.length, true); // file name length
  header.setUint16(30, 0, true); // extra field length
  header.setUint16(32, 0, true); // file comment length
  header.setUint16(34, 0, true); // disk number start
  header.setUint16(36, 0, true); // internal file attributes
  header.setUint32(38, 0, true); // external file attributes
  header.setUint32(42, localHeaderOffset, true); // relative offset of local header

  const bytes = new Uint8Array(header.byteLength + fileNameBytes.length);
  bytes.set(new Uint8Array(header.buffer), 0);
  bytes.set(fileNameBytes, header.byteLength);

  return bytes;
};

const createEndOfCentralDirectory = (
  centralDirectorySize: number,
  centralDirectoryOffset: number,
  totalEntries: number,
) => {
  const header = new DataView(new ArrayBuffer(22));

  header.setUint32(0, 0x06054b50, true); // end of central dir signature
  header.setUint16(4, 0, true); // number of this disk
  header.setUint16(6, 0, true); // disk where central directory starts
  header.setUint16(8, totalEntries, true); // number of central directory records on this disk
  header.setUint16(10, totalEntries, true); // total number of central directory records
  header.setUint32(12, centralDirectorySize, true); // size of central directory
  header.setUint32(16, centralDirectoryOffset, true); // offset of start of central directory
  header.setUint16(20, 0, true); // .ZIP file comment length

  return new Uint8Array(header.buffer);
};

export const createZipBlob = (entries: ZipEntryInput[], mimeType: string): Blob => {
  let offset = 0;
  const localParts: Uint8Array[] = [];
  const centralRecords: Uint8Array[] = [];

  entries.forEach((entry) => {
    const dataBytes = typeof entry.data === 'string' ? encodeUtf8(entry.data) : entry.data;
    const localHeader = createLocalFileHeader(entry, offset, dataBytes);
    localParts.push(localHeader.bytes);
    offset += localHeader.size;

    const centralRecord = createCentralDirectoryRecord(entry, localHeader.fileNameBytes, localHeader.offset, dataBytes);
    centralRecords.push(centralRecord);
  });

  const centralDirectoryOffset = offset;
  const centralDirectorySize = centralRecords.reduce((total, record) => total + record.length, 0);
  const endRecord = createEndOfCentralDirectory(centralDirectorySize, centralDirectoryOffset, entries.length);

  const totalSize =
    localParts.reduce((total, part) => total + part.length, 0) + centralDirectorySize + endRecord.length;
  const output = new Uint8Array(totalSize);

  let position = 0;
  localParts.forEach((part) => {
    output.set(part, position);
    position += part.length;
  });

  centralRecords.forEach((record) => {
    output.set(record, position);
    position += record.length;
  });

  output.set(endRecord, position);

  return new Blob([output], { type: mimeType });
};
