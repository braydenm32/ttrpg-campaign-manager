import { cloudErrorMessage } from '../cloud/client'
import { answerCharacterRequest, approveClaim, deleteQuestion, releaseCharacter, type CharacterRequest } from '../cloud/players'
import { afterUndo, toast } from '../undo'
import { deleteDowntime } from './Downtime'
import { holdBack, type PendingClaim } from './inbox'

/**
 * The Inbox's answers that can't be taken back once they reach the server or a player: deleting a
 * question or downtime, approving or turning down a claim, turning down a new character. Each one
 * leaves the list at once with an Undo note, and only happens once the note goes (see afterUndo).
 */

function answerLater(key: string, text: string, commit: () => Promise<unknown>, reload: () => Promise<unknown>) {
  holdBack(key, true)
  afterUndo(
    text,
    async () => {
      try {
        await commit()
        await reload()
      } catch (e) {
        toast(`That didn’t go through: ${cloudErrorMessage(e)}`)
      } finally {
        holdBack(key, false)
      }
    },
    () => holdBack(key, false),
  )
}

export const deleteQuestionLater = (worldId: string, id: string, reload: () => Promise<unknown>) =>
  answerLater(id, 'Question deleted.', () => deleteQuestion(worldId, id), reload)

export const deleteDowntimeLater = (worldId: string, id: string, reload: () => Promise<unknown>) =>
  answerLater(id, 'Downtime deleted.', () => deleteDowntime(worldId, id), reload)

/** Approving lets the player edit the character and read what's written for them, so it waits out its Undo too. */
export const approveClaimLater = (worldId: string, c: PendingClaim, name: string, reload: () => Promise<unknown>) =>
  answerLater(`claim:${c.entityId}`, `${c.who} now plays ${name}.`, () => approveClaim(worldId, c.entityId), reload)

export const declineClaimLater = (worldId: string, c: PendingClaim, name: string, reload: () => Promise<unknown>) =>
  answerLater(`claim:${c.entityId}`, `Turned down ${c.who}’s request to play ${name}.`, () => releaseCharacter(worldId, c.entityId, false), reload)

export const turnDownCharacterLater = (worldId: string, r: CharacterRequest, note: string, reload: () => Promise<unknown>) =>
  answerLater(r.id, `${r.sheet.name} turned down.`, () => answerCharacterRequest(worldId, r.id, false, note), reload)
