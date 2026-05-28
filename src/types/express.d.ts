import { IUser } from "../models/User.model";

declare global {
  namespace Express {
    namespace Multer {
      interface File {
        fieldname: string;
        originalname: string;
        encoding: string;
        mimetype: string;
        size: number;
        buffer: Buffer;
      }
    }

    interface Request {
      user?: IUser;
      file?: Multer.File;
    }
  }
}

export {};