import './index.css';
import './polyfills/fetch';
import { bootstrap } from './boot';

void bootstrap(() => import('./app'));
