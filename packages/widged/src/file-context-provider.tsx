import { createContext, useContext, createSignal, JSX } from 'solid-js';

import intro from '../widgets/intro/intro';

// Define the type for the context value
interface FileContentContextType {
  fileContent: () => string;
  setContent: (content: string) => void;
}

// Create the context with a default value
const FileContentContext = createContext<FileContentContextType>();

// Create a provider component
export function FileContentProvider(props: { children: JSX.Element }) {
  const [fileContent, setFileContent] = createSignal<string>(
    JSON.stringify(intro, null, 2)
  );

  const setContent = (content: string) => {
    setFileContent(content);
  };

  return (
    <FileContentContext.Provider value={{ fileContent, setContent }}>
      {props.children}
    </FileContentContext.Provider>
  );
}

// Create a custom hook to use the context
export function useFileContent() {
  const context = useContext(FileContentContext);
  if (!context) {
    throw new Error('useFileContent must be used within a FileContentProvider');
  }
  return context;
}
