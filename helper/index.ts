export const getFileId = (): string => {
  const chars: string[] = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];
  return (
    chars[Math.floor(Math.random() * 10)] +
    Math.floor(Math.random() * 1000) +
    chars[Math.floor(Math.random() * 10)]
  );
};

export const formatDate = (dateStr: string): string => {
  const date: Date = new Date(dateStr);
  const day: string = String(date.getDate()).padStart(2, "0");
  const month: string = String(date.getMonth() + 1).padStart(2, "0");
  const year: number = date.getFullYear();
  return `${day}-${month}-${year}`;
};

interface PadFunction {
  (num: number): string;
}

export const generateCommonId = (): string => {
  const now: Date = new Date();

  const pad: PadFunction = (num: number): string =>
    num.toString().padStart(2, "0");

  const day: string = pad(now.getDate());
  const month: string = pad(now.getMonth() + 1);
  const year: number = now.getFullYear();
  const hours: string = pad(now.getHours());
  const minutes: string = pad(now.getMinutes());
  const seconds: string = pad(now.getSeconds());

  return `job${day}${month}${year}${hours}${minutes}${seconds}`;
};
