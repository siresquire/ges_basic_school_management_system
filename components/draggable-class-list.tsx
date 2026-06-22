"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Icon from "@/components/icon";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { updateClass, deleteClass, reorderClasses } from "@/app/(staff)/classes/actions";

export type ClassItem = {
  id: string;
  name: string;
  stage: string;
  level: number;
  classTeacherId: string | null;
  _count: { students: number };
  classTeacher: { id: string; firstName: string; lastName: string } | null;
};

export type TeacherItem = {
  id: string;
  firstName: string;
  lastName: string;
  levels: string;
};

const STAGE_OPTIONS = [
  { value: "CRECHE", label: "Creche" },
  { value: "KG", label: "KG" },
  { value: "PRIMARY", label: "Primary" },
  { value: "JHS", label: "JHS" },
];

function GripIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden>
      <circle cx="5" cy="4" r="1.4" />
      <circle cx="5" cy="8" r="1.4" />
      <circle cx="5" cy="12" r="1.4" />
      <circle cx="11" cy="4" r="1.4" />
      <circle cx="11" cy="8" r="1.4" />
      <circle cx="11" cy="12" r="1.4" />
    </svg>
  );
}

function SortableRow({ c, teachers, enabledStages }: { c: ClassItem; teachers: TeacherItem[]; enabledStages: string[] }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: c.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={isDragging ? "opacity-50 bg-emerald-50" : undefined}
    >
      <td className="w-8 pr-0">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="touch-none cursor-grab rounded p-1 text-gray-400 hover:text-gray-600 active:cursor-grabbing"
          title="Drag to reorder"
        >
          <GripIcon />
        </button>
      </td>
      <td>
        <form action={updateClass.bind(null, c.id)} id={`class-${c.id}`}>
          <input name="name" className="input min-w-32 py-1 text-sm" defaultValue={c.name} />
        </form>
      </td>
      <td>
        <select
          name="stage"
          form={`class-${c.id}`}
          className="input py-1 text-xs"
          defaultValue={c.stage}
        >
          {STAGE_OPTIONS.filter((o) => enabledStages.includes(o.value)).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </td>
      <td className="text-center">{c._count.students}</td>
      <td>
        <select
          name="teacherId"
          form={`class-${c.id}`}
          className="input max-w-48 py-1 text-xs"
          defaultValue={c.classTeacherId ?? ""}
        >
          <option value="">— None —</option>
          {teachers
            .filter((t) => {
              // Teachers with no levels set appear in all dropdowns
              const tLevels = t.levels ? t.levels.split(",").filter(Boolean) : [];
              return tLevels.length === 0 || tLevels.includes(c.stage);
            })
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.firstName} {t.lastName}
              </option>
            ))}
        </select>
      </td>
      <td>
        <div className="flex gap-2">
          <button form={`class-${c.id}`} className="btn-secondary btn-sm" title="Save changes">
            <Icon name="save" />
          </button>
          <button
            form={`class-${c.id}`}
            formAction={deleteClass.bind(null, c.id)}
            className="btn-danger btn-sm"
            title="Delete class"
          >
            <Icon name="trash" />
          </button>
        </div>
      </td>
      <td>
        <Link
          href={`/classes/${c.id}`}
          className="btn-secondary btn-sm"
          title="View class"
        >
          <Icon name="eye" />
        </Link>
      </td>
    </tr>
  );
}

export default function DraggableClassList({
  initialClasses,
  teachers,
  enabledStages,
}: {
  initialClasses: ClassItem[];
  teachers: TeacherItem[];
  enabledStages: string[];
}) {
  const [classes, setClasses] = useState(initialClasses);
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = classes.findIndex((c) => c.id === active.id);
    const newIndex = classes.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(classes, oldIndex, newIndex);
    setClasses(reordered);

    startTransition(async () => {
      await reorderClasses(reordered.map((c) => c.id));
    });
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={classes.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <tbody>
          {classes.map((c) => (
            <SortableRow key={c.id} c={c} teachers={teachers} enabledStages={enabledStages} />
          ))}
        </tbody>
      </SortableContext>
    </DndContext>
  );
}
