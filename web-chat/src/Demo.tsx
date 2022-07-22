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
      <nav></nav>
      <Outlet />
    </div>
  )
}

function Lobby() {
  const waku = useWaku()
  const messages = useMessageHistory()
  const pubkey = usePubkey()
  const [draft, setDraft] = useState('')
  const [nick, setNick] = useLocalStorage('nick', generate())

  // if we're in a channel
  const { chan } = useParams()
  const chanPubkeys = chan?.split(',')

  if (!waku || !messages.length) return <div>loading...</div>

  // glean list of members (pubkey: nick)
  const pubkeyMap: Record<string, string> = {}
  for (let msg of messages) {
    pubkeyMap[msg.chatMessage.fromPubkey] = msg.chatMessage.nick
  }

  // glean chan list from visible messages
  const chanMap: Record<string, string[]> = {}
  for (let msg of messages) {
    let chan = msg.chatMessage.chan
    if (chan) {
      const nicks = chan
        .split(',')
        .map((k) => pubkeyMap[k] || k.substring(0, 12))
      chanMap[chan] = nicks
    }
  }

  // if we are in a chan... get the members
  const chanNicks = chanPubkeys?.map((pk) => pubkeyMap[pk])

  const visibleMessages = messages.filter((m) => m.chatMessage.chan === chan)

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
      if (chanPubkeys) {
        return Promise.all(
          chanPubkeys.map(async (encPublicKey) => {
            const wakuMsg = await WakuMessage.fromUtf8String(
              message.encode(),
              ChatContentTopic,
              { timestamp, encPublicKey }
            )
            // console.log('sending message', { chan, encPublicKey })
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

  return (
    <div style={{ display: 'flex' }}>
      <nav>
        <Link to="/">Lobby</Link>

        <hr />
        {Object.entries(chanMap).map(([chan, nicks]) => (
          <Link key={chan} to={`/dm/${chan}`}>
            {nicks.map((nick) => (
              <span key={nick}>{nick}</span>
            ))}
          </Link>
        ))}
        <hr />

        <Link to="/dm">+ New Chat</Link>
      </nav>

      <div
        className="chat-main"
        style={{
          height: '100vh',
          width: '100vw',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            background: 'aliceblue',
            padding: 10,
            fontSize: 24,
            fontWeight: 'bold',
          }}
        >
          chan: {chanNicks ? chanNicks.join(', ') : 'Lobby'}
        </div>
        <div style={{ flexGrow: 1, overflow: 'auto', padding: 5 }}>
          {visibleMessages.length === 0 ? (
            <div style={{ padding: 30, fontSize: 24 }}>
              No messages yet... say something
            </div>
          ) : null}
          {visibleMessages.map((msg, idx) => (
            <div key={idx}>
              <b>{pubkeyMap[msg.chatMessage.fromPubkey]}: </b>
              {msg.chatMessage.payload}
            </div>
          ))}
          <AlwaysScrollToBottom messages={messages} />
        </div>

        <form
          onSubmit={sendMessage}
          style={{ background: 'pink', padding: 10 }}
        >
          <input
            type="text"
            required
            value={nick}
            onChange={(e) => setNick(e.target.value)}
          />
          <input
            type="text"
            placeholder="say something..."
            required
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button>say</button>
        </form>
      </div>
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
    <form
      onSubmit={handleSubmit}
      style={{
        maxWidth: 800,
        margin: '50px auto',
        border: '1px solid #333',
        padding: 10,
      }}
    >
      {Object.entries(pubkeyMap).map(([pubkey, nick]) => (
        <label style={{ display: 'block' }} key={pubkey}>
          <input type="checkbox" name={pubkey} />
          <b title={pubkey}>{nick}</b>
        </label>
      ))}
      <button>chat</button>
    </form>
  )
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
  }, [waku])

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

    function handleRelayMessage(wakuMsg: WakuMessage) {
      const msg = Message.fromWakuMessage(wakuMsg)
      if (msg) {
        dispatchMessages([msg])
      }
    }

    loadHistory(waku).then((history) => {
      dispatchMessages(history)
      waku.relay.addObserver(handleRelayMessage, [ChatContentTopic])
    })

    return function cleanUp() {
      waku?.relay.deleteObserver(handleRelayMessage, [ChatContentTopic])
    }
  }, [waku])

  function reduceMessages(state: Message[], newMessages: Message[]) {
    return state.concat(newMessages)
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
