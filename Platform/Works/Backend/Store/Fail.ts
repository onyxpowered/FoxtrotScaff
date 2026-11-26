export class Fail extends Error {
  constructor(public Status: number, Message: string) {
    super(Message);
  }
}
