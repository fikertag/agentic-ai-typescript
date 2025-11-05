import fs from "fs";
import path from "path";

export interface Document {
  name: string;
  text: string;
}

export function loadDocuments(dataDir: string = "data"): Document[] {
  const fullPath = path.join(process.cwd(), dataDir);
  const files = fs.readdirSync(fullPath);
  const documents: Document[] = [];

  for (const file of files) {
    const filePath = path.join(fullPath, file);
    if (fs.statSync(filePath).isFile() && file.endsWith(".txt")) {
      const text = fs.readFileSync(filePath, "utf-8");
      documents.push({ name: file, text });
    }
  }

  return documents;
}
