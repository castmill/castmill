import type { Component } from 'solid-js';
import Versions from './components/Versions';
import PlayerFrame from './components/PlayerFrame';

const App: Component = () => {
  return (
    <>
      <PlayerFrame />
      <Versions />
    </>
  );
};

export default App;
