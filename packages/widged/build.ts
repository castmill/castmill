
// Importing the intro template
import { intro } from './dist/widgets';

// Serializing the intro template
const introSerialized = JSON.stringify(intro, null, 2);

// Save the serialized intro template to a file in /dist (using node)
import { writeFileSync, mkdirSync } from 'fs';
mkdirSync('./dist/widgets', { recursive: true });
writeFileSync('./dist/widgets/intro.json', introSerialized);
