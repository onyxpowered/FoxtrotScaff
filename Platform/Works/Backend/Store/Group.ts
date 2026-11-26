export function Group<T, K>(Rows: T[], Key: (Row: T) => K) {
  const Groups = new Map<K, T[]>();
  for (const Row of Rows) {
    const List = Groups.get(Key(Row));
    if (List) List.push(Row);
    else Groups.set(Key(Row), [Row]);
  }
  return Groups;
}
