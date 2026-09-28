import { Card, CardBody } from '@wordpress/components';
import useStateContext from './context/useStateContext';
import { setOptions } from './context/actions';
import FieldRenderer from './FieldRenderer';
import LockedForm from './LockedForm';
import GatewayOverviewField from './fields/GatewayOverviewField';
import htmlHelp from './fields/htmlHelp';
import styles from './SettingsForm.module.scss';

const DISPLAY_ONLY = [ 'title', 'desc' ];

const isChecked = ( value ) => '1' === value || true === value;

function renderDisplayOnly( field, index ) {
	if ( 'title' === field.type ) {
		return field.title ? <h3 key={ index }>{ field.title }</h3> : null;
	}

	return field.text ? <p key={ index }>{ htmlHelp( field.text ) }</p> : null;
}

export default function SettingsForm( { section } ) {
	const { state, dispatch } = useStateContext();

	const getValue = ( field ) =>
		Object.prototype.hasOwnProperty.call( state.options, field.name )
			? state.options[ field.name ]
			: field.default;

	const handleChange = ( field, value ) => {
		dispatch( setOptions( { ...state.options, [ field.name ]: value } ) );
	};

	const getGatewayValue = ( gateway ) => {
		const name = 'dlm_gateway_' + gateway.id + '_enabled';

		return Object.prototype.hasOwnProperty.call( state.options, name )
			? '1' === state.options[ name ]
			: gateway.enabled;
	};

	const handleGatewayChange = ( gateway, checked ) => {
		dispatch( setOptions( { ...state.options, [ 'dlm_gateway_' + gateway.id + '_enabled' ]: checked ? '1' : '0' } ) );
	};

	if ( ! section.fields || 0 === section.fields.length ) {
		return null;
	}

	const fieldsByName = {};
	section.fields.forEach( ( field ) => {
		if ( field.name ) {
			fieldsByName[ field.name ] = field;
		}
	} );

	const isFieldVisible = ( field, parentCheckboxValue ) => {
		if ( ! field.child ) {
			return true;
		}

		if ( true === field.child ) {
			return isChecked( parentCheckboxValue );
		}

		const controllingField = fieldsByName[ field.child.field ];
		const controllingValue = controllingField ? getValue( controllingField ) : undefined;
		const expected = field.child.value;

		return Array.isArray( expected ) ? expected.includes( controllingValue ) : expected === controllingValue;
	};

	const renderField = ( field, index, disabled ) => {
		if ( DISPLAY_ONLY.includes( field.type ) ) {
			return renderDisplayOnly( field, index );
		}

		if ( 'gateway_overview' === field.type ) {
			return (
				<GatewayOverviewField
					key={ index }
					getGatewayValue={ getGatewayValue }
					onGatewayChange={ handleGatewayChange }
					disabled={ section.locked }
				/>
			);
		}

		if ( 'group' === field.type ) {
			return (
				<Card key={ field.name || index } className={ styles.group }>
					<CardBody>
						<h4>{ field.label }</h4>
						{ ( field.options || [] ).map( ( subField, subIndex ) => (
							<GroupField
								key={ subField.name || subIndex }
								field={ subField }
								value={ getValue( subField ) }
								onChange={ ( value ) => handleChange( subField, value ) }
							/>
						) ) }
					</CardBody>
				</Card>
			);
		}

		return (
			<div key={ field.name || index } className={ styles.fieldWrapper }>
				<FieldRenderer
					field={ field }
					value={ getValue( field ) }
					onChange={ ( value ) => handleChange( field, value ) }
					disabled={ disabled }
				/>
			</div>
		);
	};

	// Group consecutive plain fields locked for the exact same reason so the
	// "upgrade to plan X" message only shows once per group instead of once per field.
	let parentCheckboxValue = null;
	const groups = [];

	section.fields.forEach( ( field, index ) => {
		if ( ! isFieldVisible( field, parentCheckboxValue ) ) {
			return;
		}

		if ( 'checkbox' === field.type && ! field.child ) {
			parentCheckboxValue = getValue( field );
		}

		const isPlainField = ! DISPLAY_ONLY.includes( field.type ) && 'gateway_overview' !== field.type && 'group' !== field.type;
		const fieldLocked = isPlainField && ( section.locked || !! field.locked );
		const fieldBadge = field.badge || section.badge;
		const fieldReason = field.reason || section.reason;
		const fieldExtensionName = field.extensionName || section.extensionName;
		const lockKey = fieldLocked ? `${ fieldBadge || '' }|${ fieldReason || '' }` : null;

		const last = groups[ groups.length - 1 ];

		if ( lockKey && last && last.lockKey === lockKey ) {
			last.items.push( { field, index } );

			return;
		}

		groups.push( { lockKey, badge: fieldBadge, reason: fieldReason, extensionName: fieldExtensionName, items: [ { field, index } ] } );
	} );

	return (
		<div className={ styles.form }>
			{ section.locked && <LockedForm badge={ section.badge } reason={ section.reason } extensionName={ section.extensionName } /> }

			{ groups.map( ( group, groupIndex ) => {
				if ( ! group.lockKey ) {
					return group.items.map( ( { field, index } ) => renderField( field, index, false ) );
				}

				return (
					<div key={ `locked-group-${ groupIndex }` } className={ styles.lockedGroup }>
						{ group.items.map( ( { field, index } ) => renderField( field, index, true ) ) }
						{ ! section.locked && <LockedForm badge={ group.badge } reason={ group.reason } extensionName={ group.extensionName } /> }
					</div>
				);
			} ) }
		</div>
	);
}

function GroupField( { field, value, onChange } ) {
	if ( DISPLAY_ONLY.includes( field.type ) ) {
		return renderDisplayOnly( field, field.name );
	}

	return (
		<div className={ styles.fieldWrapper }>
			<FieldRenderer field={ field } value={ value } onChange={ onChange } />
		</div>
	);
}
