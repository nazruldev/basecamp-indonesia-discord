import { ChannelType, type Client, type VoiceState } from "discord.js";
import { getTempVoiceHubIds, maxTempChannelsPerUser } from "@/config/tempVoice.js";
import {
  clearTempVoicePanelForRoom,
  deleteOtherTempVoicePanelsForOwner,
  refreshTempVoicePanelForRoom,
} from "@/bot/tempVoice/panelPoster.js";
import {
  countRoomsForUser,
  tempVoiceCreationLocks,
  tempVoiceOwners,
} from "@/bot/tempVoice/state.js";

async function fetchVoiceChannel(client: Client, channelId: string) {
  const ch = await client.channels.fetch(channelId).catch(() => null);
  return ch?.isVoiceBased() ? ch : null;
}

async function pruneOwnerIfMissingChannel(
  client: Client,
  channelId: string
): Promise<void> {
  const ch = await fetchVoiceChannel(client, channelId);
  if (!ch) tempVoiceOwners.delete(channelId);
}

async function deleteTempChannel(client: Client, channelId: string): Promise<void> {
  await clearTempVoicePanelForRoom(client, channelId);

  const ch = await fetchVoiceChannel(client, channelId);
  if (!ch) {
    tempVoiceOwners.delete(channelId);
    return;
  }
  try {
    await ch.delete();
  } catch (e: unknown) {
    const code =
      e && typeof e === "object" && "code" in e
        ? (e as { code: number }).code
        : 0;
    if (code !== 10_003) console.error("[tempvoice] hapus channel:", e);
  }
  tempVoiceOwners.delete(channelId);
}

async function cleanupEmptyTempRooms(client: Client): Promise<void> {
  for (const channelId of [...tempVoiceOwners.keys()]) {
    const ch = await fetchVoiceChannel(client, channelId);
    if (!ch) {
      tempVoiceOwners.delete(channelId);
      continue;
    }

    try {
      const full = await ch.fetch();
      if (full.members.size === 0) {
        await deleteTempChannel(client, channelId);
      }
    } catch {
      await pruneOwnerIfMissingChannel(client, channelId);
    }
  }
}

function makeTempRoomName(memberName: string): string {
  return `🔊 ${memberName}'s`.slice(0, 100);
}

export default async (oldState: VoiceState, newState: VoiceState) => {
  const hubs = getTempVoiceHubIds();
  if (hubs.size === 0) return;

  const oldCh = oldState.channel;
  const newCh = newState.channel;
  const member = newState.member ?? oldState.member;
  if (!member) return;

  const client = newState.client;
  await cleanupEmptyTempRooms(client).catch(() => {});

  /* Masuk hub */
  if (newCh && (!oldCh || oldCh.id !== newCh.id) && hubs.has(newCh.id)) {
    if (tempVoiceCreationLocks.has(member.id)) return;

    const ownedRoomIds = [...tempVoiceOwners.entries()]
      .filter(([, ownerId]) => ownerId === member.id)
      .map(([channelId]) => channelId);

    for (const roomId of ownedRoomIds) {
      const room = await fetchVoiceChannel(client, roomId);
      if (!room) {
        tempVoiceOwners.delete(roomId);
        continue;
      }

      try {
        const full = await room.fetch();
        const othersCount = [...full.members.values()].filter(
          (m) => m.id !== member.id
        ).length;

        if (othersCount > 0) continue;

        const isCurrentFromTemp = oldCh?.id === full.id;
        if (!isCurrentFromTemp) {
          await deleteTempChannel(client, full.id);
        }
      } catch {
        await pruneOwnerIfMissingChannel(client, roomId);
      }
    }

    tempVoiceCreationLocks.add(member.id);
    try {
      const name = makeTempRoomName(member.displayName);
      const createOpts: {
        name: string;
        type: typeof ChannelType.GuildVoice;
        parent?: string | null;
      } = {
        name,
        type: ChannelType.GuildVoice,
      };
      if (newCh.parentId) createOpts.parent = newCh.parentId;
      const created = await newCh.guild.channels.create(createOpts);

      tempVoiceOwners.set(created.id, member.id);

      try {
        await member.voice.setChannel(created);

        if (
          oldCh &&
          tempVoiceOwners.get(oldCh.id) === member.id &&
          oldCh.id !== created.id
        ) {
          try {
            const oldFull = await oldCh.fetch();
            if (oldFull.members.size === 0) {
              await deleteTempChannel(client, oldFull.id);
            }
          } catch {
            await pruneOwnerIfMissingChannel(client, oldCh.id);
          }
        }

        if (countRoomsForUser(member.id) > maxTempChannelsPerUser()) {
          await deleteTempChannel(client, created.id);
          try {
            await member.send(
              `Kamu sudah melewati batas **${maxTempChannelsPerUser()}** room aktif.`
            );
          } catch {
            /* DM off */
          }
          return;
        }

        await deleteOtherTempVoicePanelsForOwner(
          client,
          member.id,
          created.id
        );
      } catch (moveErr) {
        console.error(
          "[tempvoice] pindah user ke room baru gagal (cek permission Connect/View):",
          moveErr
        );
        await created.delete().catch(() => {});
        tempVoiceOwners.delete(created.id);
      }
    } catch (err) {
      console.error("[tempvoice] buat channel:", err);
    } finally {
      tempVoiceCreationLocks.delete(member.id);
    }
    return;
  }

  /* Keluar / pindah dari room temp: hapus jika kosong (harus sebelum panel supaya pindah room A→B tetap bersih) */
  if (oldCh && tempVoiceOwners.has(oldCh.id)) {
    const movedAway = !newCh || newCh.id !== oldCh.id;
    if (movedAway) {
      try {
        const full = await oldCh.fetch();
        if (full.members.size === 0) {
          await deleteTempChannel(client, oldCh.id);
        }
      } catch {
        await pruneOwnerIfMissingChannel(client, oldCh.id);
      }
    }
  }

  /* Pemilik masuk / pindah ke room temp: panel baru (hapus panel lama untuk room ini) */
  if (
    newCh &&
    tempVoiceOwners.has(newCh.id) &&
    tempVoiceOwners.get(newCh.id) === member.id &&
    (!oldCh || oldCh.id !== newCh.id) &&
    !hubs.has(newCh.id)
  ) {
    await refreshTempVoicePanelForRoom(client, newCh.id).catch((e) =>
      console.error("[tempvoice] refresh panel:", e)
    );

    const notify = process.env.TEMPVOICE_PANEL_DM_NOTIFY?.trim();
    if (notify === "1" || notify?.toLowerCase() === "true") {
      const panelId = process.env.TEMPVOICE_PANEL_CHANNEL_ID?.trim();
      const textCh = panelId
        ? await client.channels.fetch(panelId).catch(() => null)
        : null;
      const mention =
        textCh && "guild" in textCh && textCh.guild
          ? `Lihat <#${textCh.id}>.`
          : "Cek channel panel di server.";
      try {
        await member.send({
          content: `Panel kontrol room voice-mu sudah diperbarui. ${mention}`,
        });
      } catch {
        /* DM tertutup */
      }
    }
  }
};
