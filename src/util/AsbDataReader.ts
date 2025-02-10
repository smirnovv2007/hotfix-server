import { EndianBinaryReader } from "./EndianBinaryReader";

class AsbBlock {
	assetName: string;
	assetID: number;
	size: number;
	isStart: boolean;
	temp: Buffer;

	constructor() {
		this.assetName = "";
		this.assetID = 0;
		this.size = 0;
		this.isStart = false;
		this.temp = Buffer.alloc(4);
	}
}

class BlockV {
	length: number;
	asbBlocks: AsbBlock[];

	constructor() {
		this.length = 0;
		this.asbBlocks = [];
	}

	readData(data: Buffer, debug = false, useSwap = false): void {
		// Initialize the reader with the given options.
		const reader = new EndianBinaryReader(data, useSwap, debug);

		// Skip the first 20 bytes (header).
		reader.readBytes(20);

		// Read the length field as little-endian (the fix).
		this.length = reader.readInt32LE();

		// Skip the next 4 bytes.
		reader.readInt32BE();

		// For each block, parse the data.
		for (let i = 0; i < this.length; i++) {
			const block = new AsbBlock();

			// Read a 16-byte hash and assign it as the asset name.
			block.assetName = reader.readHash();

			// Read a 4-byte temporary buffer.
			block.temp = reader.readBytes(4);

			// Convert the temp buffer to a little-endian int32 for assetID.
			block.assetID = block.temp.readInt32LE(0);

			// Read the block size (big-endian int32).
			block.size = reader.readInt32BE();

			// Determine the isStart flag based on the third byte of temp.
			block.isStart = (block.temp[2] >> 4) > 0;

			this.asbBlocks.push(block);
		}
	}
}

export { EndianBinaryReader, AsbBlock, BlockV };
