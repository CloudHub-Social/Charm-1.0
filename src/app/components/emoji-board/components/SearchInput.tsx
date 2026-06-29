import type { ChangeEventHandler } from 'react';
import { useRef } from 'react';
import { Input, Chip, Text, Box } from 'folds';
import { mobileOrTablet } from '$utils/user-agent';
import { ArrowRight, sizedIcon, MagnifyingGlass, X } from '$components/icons/phosphor';
import { EmojiBoardTab } from '$components/emoji-board/types';

type SearchInputProps = {
  tab: EmojiBoardTab;
  query?: string;
  value?: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  onClear?: () => void;
  allowTextCustomEmoji?: boolean;
  onTextCustomEmojiSelect?: (text: string) => void;
  placeholder?: string;
};
export function SearchInput({
  tab,
  query,
  value,
  onChange,
  onClear,
  allowTextCustomEmoji,
  onTextCustomEmojiSelect,
  placeholder,
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleReact = () => {
    const textEmoji = inputRef.current?.value.trim();
    if (!textEmoji) return;
    onTextCustomEmojiSelect?.(textEmoji);
  };

  return (
    <Input
      ref={inputRef}
      variant="SurfaceVariant"
      size="400"
      placeholder={
        placeholder ??
        (allowTextCustomEmoji && tab !== EmojiBoardTab.Gif ? 'Search or Text Reaction' : 'Search')
      }
      value={value}
      maxLength={50}
      before={sizedIcon(MagnifyingGlass, '50')}
      after={
        allowTextCustomEmoji && query && tab !== EmojiBoardTab.Gif ? (
          <Chip
            variant="Primary"
            radii="Pill"
            after={sizedIcon(ArrowRight, '50')}
            outlined
            onClick={handleReact}
          >
            <Text size="L400">React</Text>
          </Chip>
        ) : onClear && value ? (
          <Box
            as="button"
            type="button"
            alignItems="Center"
            justifyContent="Center"
            style={{ cursor: 'pointer' }}
            aria-label="Clear search"
            onClick={onClear}
          >
            {sizedIcon(X, '50')}
          </Box>
        ) : undefined
      }
      onChange={onChange}
      autoFocus={!mobileOrTablet()}
    />
  );
}
