import { EndianBinaryReader } from "./EndianBinaryReader";

export class DesignIndex {
  public Unk1: bigint;
  public FileCount: number;
  public Unk2: number;
  public Files: DesignIndex.FileEntry[];

  constructor() {
    this.Unk1 = 0n;
    this.FileCount = 0;
    this.Unk2 = 0;
    this.Files = [];
  }

  /**
   * Reads a DesignIndex from a Buffer.
   * @param indexBytes A Buffer containing the index data.
   */
  public static read(indexBytes: Buffer): DesignIndex {
    // Create an EndianBinaryReader.
    // (Assuming that for this file the data is stored using native LE for some fields and BE for others.)
    const reader = new EndianBinaryReader(indexBytes, false, false);

    return DesignIndex.readFromReader(reader);
  }

  /**
   * Reads a DesignIndex from an EndianBinaryReader.
   * The first field (Unk1) is read as a 64-bit little-endian value.
   * Then FileCount is read as a big-endian 32-bit integer and Unk2 as a little-endian 32-bit integer.
   */
  public static readFromReader(br: EndianBinaryReader): DesignIndex {
    const index = new DesignIndex();

    // Read Unk1 as a 64-bit little-endian integer.
    index.Unk1 = br.buffer.readBigInt64LE(br.offset);
    br.offset += 8;

    // Read FileCount as a 32-bit big-endian integer.
    index.FileCount = br.readInt32BE();

    // Read Unk2 as a 32-bit little-endian integer.
    index.Unk2 = br.readInt32LE();

    // Read each file entry.
    for (let i = 0; i < index.FileCount; i++) {
      index.Files.push(DesignIndex.FileEntry.read(br));
    }

    return index;
  }

  /**
   * Recalculates the offset for each DataEntry inside each FileEntry.
   */
  public recalcSizeOffsets(): void {
    for (const file of this.Files) {
      let offset = 0;
      for (const entry of file.Entries) {
        entry.Offset = offset;
        offset += entry.Size;
      }
    }
  }
}

export namespace DesignIndex {
  export class FileEntry {
    public NameHash: number;
    public FileHash: string;
    public ReadSize: bigint;
    public Entries: DataEntry[];
    public Unk: number;

    constructor() {
      this.NameHash = 0;
      this.FileHash = "";
      this.ReadSize = 0n;
      this.Entries = [];
      this.Unk = 0;
    }

    /**
     * Returns the calculated size (the sum of all DataEntry sizes).
     */
    public get Size(): number {
      return this.Entries.reduce((total, entry) => total + entry.Size, 0);
    }

    public static read(br: EndianBinaryReader): FileEntry {
      const entry = new FileEntry();

      // Read NameHash as a 32-bit BE integer.
      entry.NameHash = br.readInt32BE();

      // Read FileHash as a straight 16-byte hash.
      entry.FileHash = br.readStraightHash();

      // Read ReadSize as a 64-bit unsigned integer (big-endian).
      entry.ReadSize = br.readUInt64BE();

      // Read the count of DataEntry records.
      const cnt = br.readUInt32BE();

      // Read each DataEntry.
      for (let i = 0; i < cnt; i++) {
        entry.Entries.push(DataEntry.read(br));
      }

      // Verify that offsets are sequential.
      let offset = 0;
      for (const de of entry.Entries) {
        if (offset !== de.Offset) {
          throw new Error("Offset mismatch");
        }
        offset += de.Size;
      }

      // Read the extra byte.
      entry.Unk = br.readByte();

      // Validate that the sum of DataEntry sizes equals ReadSize.
      if (entry.ReadSize !== BigInt(entry.Size)) {
        throw new Error(
          `Size mismatch in filehash ${entry.FileHash}: read ${entry.ReadSize}, calc ${entry.Size} (diff ${entry.ReadSize - BigInt(entry.Size)})`
        );
      }
      return entry;
    }
  }

  export class DataEntry {
    public NameHash: number;
    public Size: number;
    public Offset: number;

    constructor() {
      this.NameHash = 0;
      this.Size = 0;
      this.Offset = 0;
    }

    public static read(br: EndianBinaryReader): DataEntry {
      const entry = new DataEntry();
      entry.NameHash = br.readInt32BE();
      entry.Size = br.readUInt32BE();
      entry.Offset = br.readUInt32BE();
      return entry;
    }
  }
}
