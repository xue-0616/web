export const getStartCommandParameter = (text: string | undefined): string | null => {
    const match = text?.match(/\/start (.+)/);
    return match ? match[1] : null;
};
