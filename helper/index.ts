export const getFileId = () => {
  const chars = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];
  return (
    chars[Math.floor(Math.random() * 10)] +
    Math.floor(Math.random() * 1000) +
    chars[Math.floor(Math.random() * 10)]
  );
};

export const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};
