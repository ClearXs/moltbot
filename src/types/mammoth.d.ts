declare module "mammoth" {
  const mammoth: {
    convertToMarkdown: (input: { buffer: Buffer }) => Promise<{
      value: string;
      messages: Array<{ type: string; message: string }>;
    }>;
  };
  export = mammoth;
}
