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
    category: "Inventory",
    sub_categories: [
      { id: 101, name: "Tenant Checking In" },
      { id: 102, name: "Tenant Checking Out" },
      { id: 103, name: "Property Take Over From LL" },
      { id: 104, name: "Property Take Over TO LL" },
    ],
  },

  {
    id: 2,
    category: "Property Visit",
    sub_categories: [{ id: 201, name: "Property Visit" }],
  },
  {
    id: 3,
    category: "Legal",
    sub_categories: [
      { id: 301, name: "Contracts" },
      { id: 302, name: "IDs" },
      { id: 303, name: "EPC" },
    ],
  },
];
