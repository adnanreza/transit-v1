declare module 'mapshaper' {
  const mapshaper: {
    applyCommands(
      commands: string,
      input?: Record<string, string | Buffer>,
    ): Promise<Record<string, Buffer>>
  }
  export default mapshaper
}
