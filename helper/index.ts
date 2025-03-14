export const getFileId = () => {
  const chars = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];
  return (
    chars[Math.floor(Math.random() * 10)] +
    Math.floor(Math.random() * 1000) +
    chars[Math.floor(Math.random() * 10)]
  );
};
