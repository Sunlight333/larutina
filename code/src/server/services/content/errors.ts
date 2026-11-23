// A problem the panel shows to the person editing: the message is in
// Spanish and `field` names the input it belongs to, when there is one.
export class ContentError extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message)
  }
}
