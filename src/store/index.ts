import Vue from "vue";
import Vuex, { StoreOptions } from "vuex";

Vue.use(Vuex);

export interface RootState {
  version: string;
}

const player = {};

const store: StoreOptions<RootState> = {
  state: {
    version: "1.0.0" // a simple property
  },
  modules: {
    player
  }
};

export default new Vuex.Store<RootState>(store);
