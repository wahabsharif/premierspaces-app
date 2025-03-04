// categoryData.ts

export interface FileUploadCategoryObject {
  id: number;
  name: string;
}

export interface Category {
  id: number;
  category: string;
  sub_categories: FileUploadCategoryObject[];
}

export const categories: Category[] = [
  {
    id: 1,
    category: "Nature",
    sub_categories: [
      { id: 101, name: "Mountains" },
      { id: 102, name: "Forests" },
      { id: 103, name: "Oceans" },
    ],
  },
  {
    id: 2,
    category: "Architecture",
    sub_categories: [
      { id: 201, name: "Modern" },
      { id: 202, name: "Classic" },
      { id: 203, name: "Gothic" },
    ],
  },
  {
    id: 3,
    category: "Technology",
    sub_categories: [
      { id: 301, name: "Gadgets" },
      { id: 302, name: "Software" },
      { id: 303, name: "AI" },
    ],
  },
];
