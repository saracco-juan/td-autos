# Reusable web tabs

`frontend/web/src/components/Tabs.tsx` is presentation-only. It accepts stable
`{ id, label }` items, an accessible tablist label and a render callback for the
active panel. Vehicle fields, calculator data and form validation stay outside it.

Without `value` / `onValueChange`, each instance owns its selection independently.
To synchronize instances, keep one selected item ID in their parent:

```tsx
const [section, setSection] = useState('general')
<Tabs label="First vehicle sections" items={items}
  value={section} onValueChange={setSection}>
  {(id) => renderFirstVehicle(id)}
</Tabs>
<Tabs label="Second vehicle sections" items={items}
  value={section} onValueChange={setSection}>
  {(id) => renderSecondVehicle(id)}
</Tabs>
```

Instances have unique ARIA IDs and separate roving keyboard focus. Arrow keys wrap;
Home/End activate the first/last section. Synchronization never moves focus into
the other instance. Optional `className` / `panelClassName` allow layout composition.

Inactive panel content is unmounted. Keep editable field values in the parent
form state when adopting this primitive for vehicle entry, not inside a panel.

Comparison and the vehicle-detail specification section both use this component.
Detail uses independent local selection; comparison shares a controlled value.
Vehicle-entry form adoption remains deferred.
