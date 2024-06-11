import { JSX } from 'solid-js/jsx-runtime';
import { useFileContent } from './file-context-provider';

export const FileReaderComponent: () => JSX.Element = () => {
  const { setContent } = useFileContent();

  const handleFileChange = (
    event: Event & { currentTarget: HTMLInputElement; target: HTMLInputElement }
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setContent((e.target as FileReader).result as string);
      };
      reader.readAsText(file);
    }
  };

  return (
    <div>
      <label for="file" class="btn">
        Select Widget JSON File
      </label>

      <input
        type="file"
        id="file"
        accept=".json"
        onChange={handleFileChange}
      />
    </div>
  );
};
