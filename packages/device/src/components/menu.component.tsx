import { createSignal, onMount, type JSX } from 'solid-js'
import { createResource } from 'solid-js'
import { BaseMenu, type MenuEntry } from './basemenu.component'

// The menu entries. Make these talk to the host app. Also make sure to on
// show actions and settings that are available on the current device.
//
// There are three types of menu entries:
// - action: a simple action such as restart or shutdown
// - checkbox: a checkbox with a state
// - submenu: a submenu with children
const entries: MenuEntry[] = [
  {
    name: 'Restart',
    id: 'action1',
    type: 'action',
    action: () => console.log('restart'),
  },
  {
    name: 'Shutdown',
    id: 'action2',
    type: 'action',
    action: () => console.log('shutdown'),
  },
  {
    name: 'Reboot',
    id: 'action3',
    type: 'action',
    action: () => console.log('reboot'),
  },
  {
    name: 'Update',
    id: 'action4',
    type: 'action',
    action: () => console.log('update'),
  },
  {
    name: 'Debug mode',
    id: 'debug1',
    type: 'checkbox',
    state: false,
    action: (state: boolean) => console.log('debug mode', state),
  },
  {
    name: 'Debug mode2',
    id: 'debug2',
    type: 'checkbox',
    state: true,
    action: (state: boolean) => console.log('debug mode2', state),
  },
  {
    name: 'Advanced options',
    id: 'advanced',
    type: 'submenu',
    action: (state: boolean) => console.log('Advanced options', state),
    children: [
      {
        name: 'Debug mode3',
        id: 'debug3',
        type: 'checkbox',
        state: true,
        action: (state: boolean) => console.log('debug mode3', state),
      },
      {
        name: 'Launch interstellar rocket',
        id: 'action5',
        type: 'action',
        action: () => console.log('launch interstellar rocket'),
      },
      {
        name: 'Even more advanced options',
        id: 'advanced2',
        type: 'submenu',
        action: (state: boolean) =>
          console.log('Even more advanced options', state),
        children: [
          {
            name: 'Debug mode4',
            id: 'debug4',
            type: 'checkbox',
            state: false,
            action: (state: boolean) => console.log('debug mode4', state),
          },
          {
            name: 'Dump memory',
            id: 'action6',
            type: 'action',
            action: () => console.log('dump memory'),
          },
        ],
      },
    ],
  },
]

// Test dynamic header
const [count, setCount] = createSignal(0)

setInterval(() => {
  setCount((count() + 1) % 100)
}, 1000)

const header = (
  <>
    <h1>Menu header</h1>
    <p>Foo: 1</p>
    <p>Bar: 2</p>
    <p>Baz: 3</p>
    <p>Qux: {count()}</p>
  </>
)

export function MenuComponent() {
  return <BaseMenu header={header} entries={entries} />
}
