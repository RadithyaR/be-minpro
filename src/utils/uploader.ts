import { NextFunction, Request, Response } from "express";
import multer from "multer";
import { join } from "path";
import fs from "fs";

type Callback = (error: Error | null, destination: string) => void;

const defaultDir = join(__dirname, "../../public");

export const memoryUploader = () => {
  const storage = multer.memoryStorage();

  return multer({ storage });
};

const uploader = (filePrefix: string, folderName?: string) => {
  const storage = multer.diskStorage({
    //directory penyimpanan
    destination: (_req: Request, _file: Express.Multer.File, cb: Callback) => {
      const destination = folderName
        ? join(defaultDir, folderName)
        : defaultDir;

      if (!fs.existsSync(destination)) {
        fs.mkdirSync(destination);
      }

      cb(null, destination);
    },

    //mengubah format nama file
    filename: (_req: Request, file: Express.Multer.File, cb: Callback) => {
      const originalNameParts = file.originalname.split(".");

      const fileExtension = originalNameParts[originalNameParts.length - 1];

      const newFilename = filePrefix + Date.now() + "." + fileExtension;

      cb(null, newFilename);
    },
  });

  return multer({ storage });
};

export const singleFile = (
  filePrefix: string,
  folderName?: string,
  fieldName: string = "file"
) => {
  return [
    uploader(filePrefix, folderName).single(fieldName),
    (req: Request, _res: Response, next: NextFunction) => {
      const { file } = req;

      if (file) {
        file.path = folderName + "/" + (file?.filename + "");
      }

      next();
    },
  ];
};
