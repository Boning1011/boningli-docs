import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

const FeatureList = [
  {
    title: 'Technical Guides',
    Svg: require('@site/static/img/undraw_docusaurus_mountain.svg').default,
    description: (
      <>
        In-depth guides for Houdini workflows, render farm setups,
        and VFX pipeline tools. Step-by-step instructions with examples.
      </>
    ),
  },
  {
    title: 'Quick Notes & Tips',
    Svg: require('@site/static/img/undraw_docusaurus_tree.svg').default,
    description: (
      <>
        Short tutorials and quick reference notes for Houdini COPS,
        procedural workflows, and motion design techniques.
      </>
    ),
  },
  {
    title: 'Motion COPS Toolkit',
    Svg: require('@site/static/img/undraw_docusaurus_react.svg').default,
    description: (
      <>
        Documentation for the Motion COPS toolkit - transforming Houdini
        Copernicus into a motion design powerhouse with 20+ HDAs.
      </>
    ),
  },
];

function Feature({Svg, title, description}) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <Svg className={styles.featureSvg} role="img" />
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
