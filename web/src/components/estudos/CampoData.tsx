import { DatePicker, DateField, Calendar, FieldError, Label } from "@heroui/react";

import type { CalendarDate } from "@internationalized/date";

type CampoDataProps = {
    label: string;
    value: CalendarDate | null;
    onChange: (data: CalendarDate | null) => void;
    minValue?: CalendarDate;
    isDisabled?: boolean;
    errorMessage?: string;
};

export function CampoData({
    label,
    value,
    onChange,
    minValue,
    isDisabled,
    errorMessage,
}: CampoDataProps) {
    return (
        <DatePicker
            value={value}
            onChange={onChange}
            minValue={minValue}
            isDisabled={isDisabled}
            isRequired
            isInvalid={Boolean(errorMessage)}
            validationBehavior="aria"
            className="w-full"
        >
            <Label className="text-sm font-medium text-[var(--color-text)]">{label} *</Label>

            <DateField.Group
                className="
          flex h-10 items-center rounded-lg border
          border-[var(--color-border)] bg-white px-3
          focus-within:border-[var(--color-primary)]
          focus-within:ring-1
          focus-within:ring-[var(--color-primary)]
        "
            >
                <DateField.Input>
                    {(segment) => <DateField.Segment segment={segment} />}
                </DateField.Input>

                <DateField.Suffix>
                    <DatePicker.Trigger>
                        <DatePicker.TriggerIndicator />
                    </DatePicker.Trigger>
                </DateField.Suffix>
            </DateField.Group>

            <FieldError>{errorMessage}</FieldError>

            <DatePicker.Popover className="rounded-lg border border-[var(--color-border)] bg-white p-2 shadow-lg">
                <Calendar aria-label={label}>
                    <Calendar.Header>
                        <Calendar.Heading />
                        <Calendar.NavButton slot="previous" />
                        <Calendar.NavButton slot="next" />
                    </Calendar.Header>

                    <Calendar.Grid>
                        <Calendar.GridHeader>
                            {(dia) => <Calendar.HeaderCell>{dia}</Calendar.HeaderCell>}
                        </Calendar.GridHeader>

                        <Calendar.GridBody>
                            {(data) => <Calendar.Cell date={data} />}
                        </Calendar.GridBody>
                    </Calendar.Grid>
                </Calendar>
            </DatePicker.Popover>
        </DatePicker>
    );
}
