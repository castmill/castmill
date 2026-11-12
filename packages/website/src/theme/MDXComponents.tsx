import MDXComponents from '@theme-original/MDXComponents';
import { Card, CardGrid, Flow, Steps } from '@site/src/components/DocCards';

// Make the documentation building blocks available in every MDX page
// without explicit imports.
export default {
  ...MDXComponents,
  Card,
  CardGrid,
  Steps,
  Flow,
};
