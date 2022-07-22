import {
  generatePrivateKey,
  getPublicKey,
  utils,
  Waku,
  WakuMessage,
} from 'js-waku'
import { FormEvent, useEffect, useReducer, useRef, useState } from 'react'
import {
  BrowserRouter,
  Routes,
  Route,
  useParams,
  useNavigate,
  Outlet,
  Link,
} from 'react-router-dom'
import { generate } from 'server-name-generator'
import { Message } from './Message'

const ChatContentTopic = '/audius-chat/2/hackathon/json'

export function Demo() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route path="/" element={<Lobby />} />
          <Route path="/dm" element={<NewChannel />} />
          <Route path="/dm/:chan" element={<Lobby />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

function Layout() {
  return (
    <div>
      <nav>
        <Link to="/">Lobby</Link>
        <Link to="/dm">New Chat</Link>
      </nav>
      <Outlet />
    </div>
  )
}

function Lobby() {
  const waku = useWaku()
  const messages = useMessageHistory()
  const pubkey = usePubkey()
  const [draft, setDraft] = useState('')
  // const nick = window.localStorage.getItem('nick') || generate()
  const [nick, setNick] = useLocalStorage('nick', generate())

  // if we're in a channel
  const { chan } = useParams()
  const chanPubkeys = chan?.split(',')

  // glean list of members (pubkey: nick)
  const pubkeyMap: Record<string, string> = {}
  for (let msg of messages) {
    pubkeyMap[msg.chatMessage.fromPubkey] = msg.chatMessage.nick
  }

  // glean chan list from visible messages
  const chanMap: Record<string, string> = {}
  for (let msg of messages) {
    let chan = msg.chatMessage.chan
    if (chan) {
      const nicks = chan
        .split(',')
        .map((k) => pubkeyMap[k] || k.substring(0, 12))
        .join(', ')
      chanMap[chan] = nicks
    }
  }

  const visibleMessages = messages.filter((m) => m.chatMessage.chan == chan)

  async function sendMessage(e: FormEvent) {
    e.preventDefault()

    if (waku && pubkey && nick && draft) {
      const timestamp = new Date()
      const timestampNumber = Math.floor(timestamp.valueOf() / 1000)
      const message = new Message(
        {
          timestamp: timestampNumber,
          nick,
          fromPubkey: pubkey,
          chan,
          payload: draft,
        },
        timestamp
      )

      setDraft('')

      // if toPubkeys exists... it's a DM
      // if it's a DM, send a message for each toPubkey
      // and also fromPubkey
      //  encPublicKey: pubkey
      // 1
      if (chanPubkeys) {
        return Promise.all(
          chanPubkeys.map(async (encPublicKey) => {
            const wakuMsg = await WakuMessage.fromUtf8String(
              message.encode(),
              ChatContentTopic,
              { timestamp, encPublicKey }
            )
            console.log('sending message', { chan, encPublicKey })
            return waku.relay.send(wakuMsg)
          })
        )
      } else {
        const wakuMsg = await WakuMessage.fromUtf8String(
          message.encode(),
          ChatContentTopic,
          { timestamp }
        )
        return waku.relay.send(wakuMsg)
      }
    }
  }

  // TODO: navbar on left with chan list...
  return (
    <div>
      <nav>
        {Object.entries(chanMap).map(([chan, name]) => (
          <Link key={chan} to={`/dm/${chan}`}>
            {name}
          </Link>
        ))}
      </nav>

      {visibleMessages.map((msg, idx) => (
        <div key={idx}>
          <b>{pubkeyMap[msg.chatMessage.fromPubkey]}: </b>
          {msg.chatMessage.payload}
        </div>
      ))}

      <AlwaysScrollToBottom messages={messages} />

      <form onSubmit={sendMessage}>
        <input
          type="text"
          required
          value={nick}
          onChange={(e) => setNick(e.target.value)}
        />
        <input
          type="text"
          required
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button>say</button>
      </form>
    </div>
  )
}

export function NewChannel() {
  const navigate = useNavigate()
  const messages = useMessageHistory()
  const pubkey = usePubkey()
  if (!messages) return <div> loading </div>

  const pubkeyMap: Record<string, string> = {}
  for (let msg of messages) {
    pubkeyMap[msg.chatMessage.fromPubkey] = msg.chatMessage.nick
  }

  function handleSubmit(e: FormEvent) {
    if (!pubkey) return
    e.preventDefault()
    const fd = new FormData(e.target as any)
    const keys = Array.from(fd.keys())
    if (!keys.includes(pubkey)) keys.push(pubkey)
    keys.sort()
    const topic = keys.join(',')
    navigate(`/dm/${topic}`)
  }

  return (
    <form onSubmit={handleSubmit}>
      {Object.entries(pubkeyMap).map(([pubkey, nick]) => (
        <label style={{ display: 'block' }} key={pubkey}>
          <input type="checkbox" name={pubkey} />
          <b>{nick}</b>
          <div style={{ fontSize: '80%', color: '#555' }}>{pubkey}</div>
        </label>
      ))}
      <button>chat</button>
    </form>
  )
}

export function Channel() {
  const { chan } = useParams()
  const pubkeys = chan?.split(',')
  if (!pubkeys || !pubkeys.length) return <div>invalid pubkey list</div>

  return <div> chan {pubkeys.join(' :: ')} </div>
}

const AlwaysScrollToBottom = (props: { messages: Message[] }) => {
  const elementRef = useRef<HTMLDivElement>()

  useEffect(() => {
    // @ts-ignore
    elementRef.current.scrollIntoView()
  }, [props.messages])

  // @ts-ignore
  return <div ref={elementRef} />
}

// -------------------------------------------
// hooks
// -------------------------------------------

const wakuPromise = Waku.create({
  libp2p: {
    config: {
      pubsub: {
        enabled: true,
        emitSelf: true,
      },
    },
  },
  bootstrap: {
    peers: [
      // "/dns4/isaac-waku.audius.co/tcp/8000/ws/p2p/16Uiu2HAmSvJ5sdNSXJkDo5NkTkH9DFoeHRTai3HLYaDpRncFM6h5",
      // "/dns4/hareesh-waku.audius.co/tcp/8000/ws/p2p/16Uiu2HAmCyh1NtKeWyKapKxQ5jB7syr6myh7D2KtG7HNuRxbUs4v",
      // "/dns4/joe-waku.audius.co/tcp/8000/ws/p2p/16Uiu2HAmBFzip5j4TvECok3oFZ1dvJyDbWgUXSd1fHSS89iVTZbW",
      // "/dns4/waku.audius2.stereosteve.com/tcp/8000/ws/p2p/16Uiu2HAmQDYtHQDWHzTrDu8uv5kYoZ1f8pvpUq1p8A2hieS3fnNn",

      '/dns4/localhost/tcp/8000/ws/p2p/16Uiu2HAm4Z7BSydTt2WmNPdm3mu57Gr5emBNjqsBJnyNiifRtzWY',
      // '/dns4/localhost/tcp/8001/ws/p2p/16Uiu2HAmSXY6voQFgDphNDQz3fFProHPFYCsC4tBvxh6BsfMVUG9',
    ],
  },
})

function useWaku() {
  const [waku, setWaku] = useState<Waku | undefined>()

  useEffect(() => {
    if (waku) return

    wakuPromise.then(setWaku).catch((e) => {
      console.log('Waku init failed ', e)
    })
  }, [])

  return waku
}

// const historyPromise = wakuPromise.then(loadHistory)

async function loadHistory(waku: Waku) {
  console.log('loading history...')
  await waku.waitForRemotePeer()
  const wakuMessages = await waku.store.queryHistory([ChatContentTopic])
  const history = wakuMessages
    .map((wakuMsg) => Message.fromWakuMessage(wakuMsg))
    .filter(Boolean) as Message[]

  history.sort((a, b) => a.timestamp - b.timestamp)
  return history
}

function useMessageHistory() {
  const waku = useWaku()
  const [messages, dispatchMessages] = useReducer(reduceMessages, [])

  useEffect(() => {
    if (!waku) return

    // if (messages.length == 0) {
    loadHistory(waku).then((history) => {
      dispatchMessages(history)
      waku.relay.addObserver(handleRelayMessage, [ChatContentTopic])
    })
    // }

    return function cleanUp() {
      waku?.relay.deleteObserver(handleRelayMessage, [ChatContentTopic])
    }
  }, [waku])

  function reduceMessages(state: Message[], newMessages: Message[]) {
    return state.concat(newMessages)
  }

  function handleRelayMessage(wakuMsg: WakuMessage) {
    console.log('Message received: ', messages, wakuMsg)
    const msg = Message.fromWakuMessage(wakuMsg)
    if (msg) {
      dispatchMessages([msg])
    }
  }

  return messages
}

function usePubkey() {
  const waku = useWaku()
  const [pubkey, setPubkey] = useState<string | undefined>()

  const localStorageKey = 'privatekey_hex'
  useEffect(() => {
    if (!localStorage.getItem(localStorageKey)) {
      const privateKey = generatePrivateKey()
      const pkHex = utils.bytesToHex(privateKey)
      console.log(`generated new privatekey: ${pkHex}`)
      localStorage.setItem(localStorageKey, pkHex)
    }

    const privateKey = utils.hexToBytes(localStorage.getItem(localStorageKey)!)
    const publicKey = getPublicKey(privateKey)
    const publicKeyHex = utils.bytesToHex(publicKey)
    setPubkey(publicKeyHex)
    console.log(`pubkey: ${publicKeyHex}`)
  }, [])

  useEffect(() => {
    if (!waku || !pubkey) return
    const hex = localStorage.getItem(localStorageKey)!
    const privateKey = utils.hexToBytes(hex)
    waku.addDecryptionKey(privateKey)
  }, [waku, pubkey])

  return pubkey
}

function useLocalStorage<T>(key: string, initialValue: T) {
  // State to store our value
  // Pass initial state function to useState so logic is only executed once
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue
    }
    try {
      // Get from local storage by key
      const item = window.localStorage.getItem(key)
      // Parse stored json or if none return initialValue
      return item ? JSON.parse(item) : initialValue
    } catch (error) {
      // If error also return initialValue
      console.log(error)
      return initialValue
    }
  })
  // Return a wrapped version of useState's setter function that ...
  // ... persists the new value to localStorage.
  const setValue = (value: T | ((val: T) => T)) => {
    try {
      // Allow value to be a function so we have same API as useState
      const valueToStore =
        value instanceof Function ? value(storedValue) : value
      // Save state
      setStoredValue(valueToStore)
      // Save to local storage
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore))
      }
    } catch (error) {
      // A more advanced implementation would handle the error case
      console.log(error)
    }
  }
  return [storedValue, setValue] as const
}
