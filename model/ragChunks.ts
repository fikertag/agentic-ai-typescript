import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IRagChunks extends Document {
  docName: string;
  chunkText: string;
  index: number;
  embedding: Types.Array<number>;
  createdAt: Date;
  updatedAt: Date;
}

const RagChunksSchema: Schema<IRagChunks> = new Schema<IRagChunks>(
  {
    docName: { type: String, required: true },
    chunkText: { type: String, required: true },
    index: { type: Number, required: true },
    embedding: { type: [Number], required: true },
  },
  { timestamps: true }
);

// Optional: unique compound index for docName + index
RagChunksSchema.index({ docName: 1, index: 1 }, { unique: true });

const RagChunks: Model<IRagChunks> =
  mongoose.models.RagChunks ||
  mongoose.model<IRagChunks>("RagChunks", RagChunksSchema);

export default RagChunks;
