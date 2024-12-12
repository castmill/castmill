/**
 * This is a helper class that allows for easy communication between iframes.
 * Copied from legacy codebase and ported to typescript
 */

function newGuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

type InboundFunctions = {
  [key: string]: (...args: any[]) => Promise<any>;
};

type OutboundFunctions = {
  [key: string]: (...args: any[]) => Promise<any>;
};

interface Resolver {
  resolve: (value?: any) => void;
  reject: (reason?: any) => void;
}

interface Action {
  ack?: boolean;
  guid: string;
  msg?: any;
  fn?: string;
  args?: any[];
  err?: {
    message: string;
  };
}

export class Msg {
  private _target: Window;
  private _inbound: InboundFunctions;
  private _resolvers: { [guid: string]: Resolver } = {};

  constructor(
    target: Window,
    inbound: InboundFunctions,
    outbound: OutboundFunctions
  ) {
    this._target = target;
    this._inbound = inbound;

    this._setupOutbound(outbound);
    window.addEventListener('message', this.handleMessage.bind(this), false);
  }

  private ack(guid: string, msg: any): void {
    this._target.postMessage(
      JSON.stringify({ ack: true, guid: guid, msg: msg }),
      '*'
    );
  }

  private nack(guid: string, err?: any): void {
    err = err || {};
    this._target.postMessage(
      JSON.stringify({
        ack: true,
        guid: guid,
        err: { message: err.message || 'Generic Error' },
      }),
      '*'
    );
  }

  private handleMessage(e: MessageEvent): void {
    let action: Action;
    try {
      action = JSON.parse(e.data);
    } catch (err) {
      // log.warn('Got unparsable message: ' + e.data);
      return;
    }

    if (action.ack) {
      const resolver = this._resolvers[action.guid];
      if (!resolver) {
        // log.warn('Could not find guid: ' + action.guid);
        return;
      }
      delete this._resolvers[action.guid];
      if (action.err) {
        resolver.reject(action.err);
      } else {
        resolver.resolve(action.msg);
      }
    } else if (action.fn) {
      const fn = this._inbound[action.fn];
      if (!fn)
        return this.nack(action.guid, {
          message: `MSG: function "${action.fn}" not implemented`,
        });
      fn.apply(this._inbound, action.args ?? [])
        .then((msg: any) => this.ack(action.guid, msg))
        .catch((err: any) => this.nack(action.guid, err));
    }
  }

  private _post(msg: Omit<Action, 'guid'>): Promise<any> {
    const guid = newGuid();
    return new Promise((resolve, reject) => {
      this._resolvers[guid] = { resolve, reject };
      const newMsg = {
        ...msg,
        guid: guid,
      };
      this._target.postMessage(JSON.stringify(newMsg), '*');
    });
  }

  private _outboundProperty(name: string): (...args: any[]) => Promise<any> {
    return (...args: any[]) => {
      return this._post({ fn: name, args: Array.from(args) });
    };
  }

  private _setupOutbound(outbound: OutboundFunctions): void {
    for (const key in outbound) {
      if (outbound.hasOwnProperty(key)) {
        outbound[key] = this._outboundProperty(key);
      }
    }
  }
}
