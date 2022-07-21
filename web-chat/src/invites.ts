import {
  generateSymmetricKey,
  getPublicKey,
  utils,
  Waku,
  WakuMessage,
} from "js-waku";

/*
TODO:
- pubkeys should be baseSomething encoded (instead of just bytesToHex)
- send a message... if you are viewing a chatId... encrypt using symetric key
- ui to list all of your chats in inviteMap (react router route for chatId?)

ALSO:
- announce channel where people announce their (handle, pubkey)
- ui to list all the people in announce
- sent messages _should_ be signed by sender (before or after symetric encrypt?)

LATER:
- support multiple symetric keys for a chat... symmetricKey as a grow only set
*/

const inviteTopic = "/audius-chat/invites/3";

export const inviteMap: Record<string, InviteMessage> = {};

// id: [member1, member2, member3]
type InviteMessage = {
  chatId: string;
  symmetricKey: string;
  pubkeys: string[];
};

export async function readMyInvites(waku: Waku) {
  console.log("fetching invites");

  const processIncomingMessage = (wakuMessage: WakuMessage) => {
    try {
      const invite = JSON.parse(wakuMessage.payloadAsUtf8) as InviteMessage;
      if (!inviteMap[invite.chatId]) {
        console.log("adding invite", invite);
        inviteMap[invite.chatId] = invite;
      }
    } catch (e) {
      // console.log(`invalid json message: ${wakuMessage.payloadAsUtf8}`);
    }
  };

  waku.relay.addObserver(processIncomingMessage, [inviteTopic]);

  const callback = (retrievedMessages: WakuMessage[]) => {
    retrievedMessages.map(processIncomingMessage);
  };

  waku.store
    .queryHistory([inviteTopic], { callback })
    .then(() => {
      console.log("fetched invite history", inviteMap);
    })
    .catch((e) => {
      console.log("Failed to retrieve messages from store", e);
    });

  // just for testing...
  // sendPretendInvites(waku);
}

//
//
// publish invented invites
//
//

type PubkeyHex = string;
export async function createChat(waku: Waku, pubkeys: PubkeyHex[]) {
  pubkeys.sort();
  const chatId = pubkeys.join(",");
  const symmetricKey = utils.bytesToHex(generateSymmetricKey());

  /// for each member, send invite
  await Promise.all(
    pubkeys.map(async (pubkey) => {
      const invite: InviteMessage = {
        chatId,
        symmetricKey,
        pubkeys,
      };
      console.log("creating invite", invite);
      const wakuMessage = await WakuMessage.fromUtf8String(
        JSON.stringify(invite),
        inviteTopic,
        {
          encPublicKey: utils.hexToBytes(pubkey),
        }
      );

      await waku.relay.send(wakuMessage);
    })
  );
}

export async function sendPretendInvites(waku: Waku) {
  setInterval(async () => {
    // pub key for invitee... just use mine for now
    const localStorageKey = "privatekey_hex";
    const privateKey = utils.hexToBytes(localStorage.getItem(localStorageKey)!);
    const publicKey = getPublicKey(privateKey);

    createChat(waku, [utils.bytesToHex(publicKey)]);
  }, 5000);
}
