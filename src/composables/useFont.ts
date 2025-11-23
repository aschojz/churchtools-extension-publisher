export const useFonts = () => {
    const fontAwesome = ({
        size = 300,
        opacity = 0.7,
        style = 300,
        color = '255, 255, 255',
    }: {
        size?: number;
        opacity?: number;
        style?: number;
        color?: string;
    }) => ({
        fill: `rgba(${color}, ${opacity})`,
        fontFamily: '"Font Awesome 6 Pro"',
        fontStyle: style,
        fontSize: size,
    });
    const fontAwesomeBrands = ({
        size = 300,
        opacity = 0.7,
        style = 300,
        color = '255, 255, 255',
    }: {
        size?: number;
        opacity?: number;
        style?: number;
        color?: string;
    }) => ({
        fill: `rgba(${color}, ${opacity})`,
        fontFamily: "'FontAwesome6Brands-Regular', 'Font Awesome 6 Brands'",
        fontStyle: style,
        fontSize: size,
    });
    const fontStyles = {
        light: 'MyriadPro-Light',
        regular: 'Myriad Pro',
        bold: 'MyriadPro-Bold',
        'light-condensed': 'MyriadPro-LightCond',
        condensed: 'MyriadPro-Cond',
        'bold-condensed': 'MyriadPro-BoldCond',
    };
    const font = ({
        size = 72,
        opacity = 1,
        style = 'regular',
        color = '255, 255, 255',
    }: {
        size?: number;
        opacity?: number;
        style?: keyof typeof fontStyles;
        color?: string;
    }) => {
        return {
            fill: `rgba(${color}, ${opacity})`,
            fontFamily: fontStyles[style],
            fontSize: size,
        };
    };

    return {
        font,
        fontAwesome,
        fontAwesomeBrands,
    };
};
