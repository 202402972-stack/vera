import { createContext, useContext } from "react";
export const UploadContext = createContext([0, () => {}]);
export const useUploads = () => useContext(UploadContext);
